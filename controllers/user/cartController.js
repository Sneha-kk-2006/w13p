    const Cart = require('../../models/cartSchema');
    const Product = require('../../models/productSchema');
    const Wishlist = require('../../models/wishlistSchema');

    const MAX_QTY = 5;






    const validateProduct = async (productId) => {
        const product = await Product.findById(productId).populate('category');



        if (!product) return { ok: false, msg: "Product not found" }
        if (!product.isActive) return { ok: false, msg: "Product is unavailable" }
        if (product.category?.isActive === false) return { ok: false, msg: "Category is blocked" }
        if (product.stock < 1) return { ok: false, msg: "Out of Stock" }

        return { ok: true, product }
    }

    const addToCart = async (req, res) => {
        try {

            if (!req.session.user?._id) {
                return res.json({ success: false, msg: 'Please login to add items to cart' });
            }
            const userId = req.session.user._id;
            const { productId, variantId } = req.body;
          

        if(!variantId){
       
              return res.json({success:false,msg:"please select a size "})
        }

            const { ok, msg, product } = await validateProduct(productId);
            if (!ok) return res.json({ success: false, msg });

            let cart = await Cart.findOne({ userId });          
            if (!cart) cart = new Cart({ userId, items: [] }); 

            const existingIndex = cart.items.findIndex(
                item => item.productId.toString() === productId.toString() && 
                        (!variantId || item.variantId?.toString() === variantId.toString())
            );

            if (existingIndex > -1) {
                const currentQty = cart.items[existingIndex].quantity;
                const newQty = currentQty + 1;
                // let  MAX_QTY=5;

                if (newQty > MAX_QTY)       return res.json({ success: false, msg: `Max ${MAX_QTY} per item` });
                
                // Check stock (either variant stock or base stock)
                let availableStock = product.stock;
                if (variantId) {
                    const variant = product.variants.id(variantId);
                    if (variant) availableStock = variant.stock;
                }

                if (availableStock === 0) return res.json({ success: false, msg: "This item is currently sold out" });
                if (newQty > availableStock) return res.json({ success: false, msg: `Only ${availableStock} in stock` });

                cart.items[existingIndex].quantity = newQty;
            } else {
                let availableStock = product.stock;
                if (variantId) {
                    const variant = product.variants.id(variantId);
                    if (variant) availableStock = variant.stock;
                }

                if (availableStock === 0) return res.json({ success: false, msg: "This item is currently sold out" });

                cart.items.push({
                    productId: product.id,
                    variantId: variantId || null,
                    quantity: 1
                });
            }

            await cart.save();

        
            await Wishlist.updateOne(
                { userId },
                { $pull: { products: { productId: productId } } }
            );

            const updatedCart = await Cart.findOne({ userId });

            return res.json({
                success: true,
                msg: 'Added to cart',
                cartCount: updatedCart.items.length
            });

        } catch (error) {
            console.error('addToCart:', error);
            res.status(500).json({ success: false, msg: 'Server error' });
        }
    };

    const getcart = async (req, res) => {
    try {
        const userId = req.session?.user?._id;
        

        if (!userId) {
            return res.redirect('/login');
        }

        let cartData = await Cart.findOne({ userId }).populate({
            path: "items.productId",
            populate: { path: 'category' }
        });

        if (!cartData || cartData.items.length === 0) {
            return res.render('user/cart', {
                items: [],
                subtotal: 0,
                discount: 0,
                total: 0,
               
            });
        }

    

        // filter out inactive products
        cartData.items = cartData.items.filter(item =>
            item.productId &&
            item.productId.isActive !== false &&
            item.productId.isDeleted !== true &&
            (!item.productId.category || (item.productId.category.isActive !== false && item.productId.category.isDeleted !== true))
        );
        
        cartData.items.sort((a, b) => new Date(b.addedAt) - new Date(a.addedAt));

        let subtotal = 0;
        let discount = 0;
        let hasSoldOutitem=false;

        const mappedItems = cartData.items.map(item => {
            const product = item.productId;
            let targetPrice = product.price || 0;
            let targetColor = product.color || 'N/A';
            let targetSize = product.size || 'N/A';
            let targetStock = product.stock || 0;
            let targetImage = product.images?.[0] || '';
            let isSoldOut=false;

            if (item.variantId && product.variants && product.variants.length > 0) {
                const variant = product.variants.find(v => v._id.toString() === item.variantId.toString());
                if (variant) {
                    targetPrice = variant.price || targetPrice;
                    targetColor = variant.color || targetColor;
                    targetSize = variant.size || targetSize;
                    targetStock = variant.stock;
                    if (variant.images && variant.images.length > 0) {
                        targetImage = variant.images[0];
                    }
                    if(variant.stock<=0||variant.stock<item.quantity){
                      isSoldOut=true;
                      hasSoldOutitem=true;
                    }
                }
            }else{
                if(product.stock<=0||product.stock<item.quantity){
                      isSoldOut=true;
                      hasSoldOutitem=true;
                }
            }

            const discountPct = product.discount || 0;
            const salePrice = Math.round(targetPrice * (1 - discountPct / 100));

            const itemSubtotal = targetPrice * item.quantity;
            const itemDiscount = (targetPrice * (discountPct / 100)) * item.quantity;

            subtotal += itemSubtotal;
            discount += itemDiscount;



            return {
                _id:          item._id,
                productId:    product._id,
                productName:  product.name,
                productImage: targetImage,
                color:        targetColor,
                size:         targetSize,
                unitPrice:    salePrice,
                oldPrice:     targetPrice,
                quantity:     item.quantity,
                totalPrice:   item.quantity * salePrice,
                stock:        targetStock,
                isSoldOut,
            
            };
        });

        const total = subtotal - discount;
        
        res.render('user/cart', {
            items: mappedItems,
            subtotal,
            discount,
            total,
            MAX_QTY,
            hasSoldOutitem,
           
        });

    } catch (error) {
        console.log("getcart error:", error);
        res.status(500).send("Server Error");
    }
    };



    const updateCartQty = async (req, res) => {
        try {
            const userId = req.session.user?._id;
            const { itemId, change } = req.body;

            let cart = await Cart.findOne({ userId }).populate("items.productId");

            const item = cart.items.id(itemId);
            if (!item) return res.json({ success: false, msg: "Item not found" });

            const product = item.productId;

            let availableStock = product.stock;
            let targetPrice = product.price || 0;
            
            if (item.variantId && product.variants && product.variants.length > 0) {
                const variant = product.variants.find(v => v._id.toString() === item.variantId.toString());
                if (variant) {
                    availableStock = variant.stock;
                    targetPrice = variant.price || targetPrice;
                }
            }
            let  MAX_QTY=10

            let newQty = item.quantity + change;
          
            if (newQty < 1) newQty = 1;

            if (availableStock === 0) {
                return res.json({ success: false, msg: "This item is currently sold out" });
            }

            if (change > 0 && newQty > MAX_QTY) {
                return res.json({ success: false, msg: `Max ${MAX_QTY} allowed` });
            }

            if (change > 0 && newQty > availableStock) {
                return res.json({ success: false, msg: `Only ${availableStock} left in stock` });
            }
           


            item.quantity = newQty;


            await cart.save();

          
            const updatedCart = await Cart.findOne({ userId }).populate("items.productId");
            
            let finalSubtotal = 0;
            let finalDiscount = 0;
            
            updatedCart.items.forEach(itm => {
                const p = itm.productId;
                if (!p) return;
                let prc = p.price || 0;
                if (itm.variantId && p.variants && p.variants.length > 0) {
                    const v = p.variants.find(v => v._id.toString() === itm.variantId.toString());
                    if (v && v.price) prc = v.price;
                }
                const dsc = p.discount || 0;
                finalSubtotal += (prc * itm.quantity);
                finalDiscount += (prc * (dsc / 100) * itm.quantity);
            });

            const total = finalSubtotal - finalDiscount;
            const salePrice = Math.round(targetPrice * (1 - (product.discount || 0) / 100));
            const itemTotal = item.quantity * salePrice;

            return res.json({ 
                success: true, 
                subtotal: finalSubtotal, 
                total, 
                itemTotal,
                quantity: item.quantity 
            });

        } catch (err) {
            console.log(err);
            res.json({ success: false });
        }
    };


const remove = async (req, res) => {
    try {
        const userId = req.session.user?._id;
        const { itemId } = req.body;

        if (!userId) return res.json({ success: false, msg: "unauthorized" });

        const cart = await Cart.findOne({ userId });
        if (!cart) return res.json({ success: false, msg: "cart not found" });

      
        const itemToDrop = cart.items.id(itemId);
        if (!itemToDrop) {
            return res.json({ success: false, msg: "Item not found in cart" });
        }

   
        const index = cart.items.findIndex(i => i._id.toString() === itemId.toString());
        if (index > -1) cart.items.splice(index, 1);

        await cart.save();

        return res.json({
            success: true,
            isEmpty: cart.items.length === 0
        });

    } catch (error) {
        console.log("error in removing in cart", error);
        res.json({ success: false, msg: "Server error" });
    }
};




const clearCart = async (req, res) => {
    try {
        const userId = req.session.user?._id;

        if (!userId) {
            return res.json({ success: false, msg: "Unauthorized" });
        }

        const cart = await Cart.findOne({ userId });

        if (!cart) {
            return res.json({ success: false, msg: "Cart not found" });
        }

        // Clear all items
        cart.items = [];

        await cart.save();

        return res.json({
            success: true,
            msg: "Cart cleared successfully"
        });

    } catch (error) {
        console.log("Error clearing cart:", error);
        return res.json({
            success: false,
            msg: "Server error"
        });
    }
};




    module.exports={addToCart,getcart,updateCartQty,remove,clearCart}