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
            const { productId } = req.body;

            const { ok, msg, product } = await validateProduct(productId);
            if (!ok) return res.json({ success: false, msg });

            let cart = await Cart.findOne({ userId });          
            if (!cart) cart = new Cart({ userId, items: [] }); 

            const existingIndex = cart.items.findIndex(
                item => item.productId.toString() === productId.toString()
            );

            if (existingIndex > -1) {
                const currentQty = cart.items[existingIndex].quantity;
                const newQty = currentQty + 1;

                if (newQty > MAX_QTY)       return res.json({ success: false, msg: `Max ${MAX_QTY} per item` });
                if (newQty > product.stock) return res.json({ success: false, msg: `Only ${product.stock} in stock` });

                cart.items[existingIndex].quantity = newQty;
            } else {
                cart.items.push({
                    productId: product.id,
                    quantity: 1,
                    price: product.price
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
                total: 0
            });
        }

    

        // filter out inactive products
        cartData.items = cartData.items.filter(item =>
            item.productId &&
            item.productId.isActive &&
            (item.productId.category?.isActive !== false)
    );
        


        const subtotal = cartData.items.reduce((sum, item) =>
            sum + item.quantity * item.productId.price, 0
        );

        const discount = cartData.items.reduce((sum, item) =>
            sum + ((item.productId.regularPrice - item.productId.price) * item.quantity), 0
        );

        const total = subtotal;


        res.render('user/cart', {
            items: cartData.items.map(item => ({
                _id:          item._id,
                productId:    item.productId._id,
                productName:  item.productId.name,
                productImage: item.productId.images?.[0] || '',
                color:        item.productId.color || 'N/A',
                size:         item.productId.size || 'N/A',
                unitPrice:    item.productId.price,
                oldPrice:     item.productId.regularPrice || item.productId.price,
                quantity:     item.quantity,
                totalPrice:   item.quantity * item.productId.price,
                stock:        item.productId.stock
            })),
            subtotal,
            discount,
            total,
            MAX_QTY
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

            let newQty = item.quantity + change;

            if (newQty < 1) newQty = 1;
            if (newQty > MAX_QTY)
                return res.json({ success: false, msg: `Max ${MAX_QTY}` });

            if (newQty > product.stock)
                return res.json({ success: false, msg: `Only ${product.stock} left` });

            item.quantity = newQty;

            await cart.save();

            return res.json({ success: true });

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