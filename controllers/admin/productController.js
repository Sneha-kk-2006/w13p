const product=require('../../models/productSchema');
const category=require('../../models/categorySchema')


const loadProduct = async (req, res) => {
    try {
        const search = req.query.search || '';
        const currentPage = parseInt(req.query.page) || 1;
        const limit = 5;

        let filter = {
            isDeleted: false,
            name: { $regex: search, $options: 'i' }
        };

        const totalProducts = await product.countDocuments(filter);

        const totalPages = Math.ceil(totalProducts / limit);

        const products = await product.find(filter)
            .populate('category')
            .skip((currentPage - 1) * limit)
            .limit(limit);

        const categories = await category.find();

        res.render('admin/product', {
            products,
            search,
            currentPage,
            totalPages,
            limit,
            total: totalProducts,
            categories,
            editProduct: null
        });

        console.log('images:', products[0]?.images);

    } catch (error) {
        console.error(error);
        res.redirect('/pageError');
    }
};



const addProduct = async (req, res) => {
    try {

        const { name, description ,image,price,stock,category, size, color} = req.body;

        const images = req.files?.map(file =>'/uploads/products/'+ file.filename) || [];
        const stockVal=parseInt(stock);
        if(isNaN(stockVal)||stockVal<0){
            return res.status(400).json({success:false,message:'invalid stock value'})
        }
        const existing=await product.findOne({name});
        if(existing){
            return res.status(400).json({success:false,message :"product already exists"})
        }
        if(price<0){
              return res.status(400).json({success:false,message :"price not negative"})
        }
        const newProduct = new product({  
            name,
            description,
            images,
            price,
            stock:stockVal,
            category,
            size: size || "",
            color: color || "",
            isActive: true,
            isDeleted: false
        });


        console.log("new product",newProduct)

        await newProduct.save();
   res.json({ success: true, message: 'Product added successfully' });
      

    } catch (error) {
        console.log("error1", error);
        res.status(500).send("Server error");
    }
};




const editProduct = async (req, res) => {
    try {
        const { name, description, price, stock, category, size, color } = req.body;
        const stockVal = parseInt(stock);

        if (isNaN(stockVal) || stockVal < 0) {
            return res.status(400).json({ success: false, message: "Invalid stock value" });
        }

        let updateData = {
            name,
            description,
            price,
            stock: stockVal,
            category,
            size: size || "",
            color: color || ""
        };

        if (req.files && req.files.length > 0) {
            updateData.images = req.files.map(file => '/uploads/products/' + file.filename);
        }

        await product.findByIdAndUpdate(req.params.id, updateData);
        return res.json({ success: true, message: 'Product updated successfully' });
    } catch (error) {
        console.log("error", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
}



const deleteProduct = async (req, res) => {
    try {

        await product.findByIdAndUpdate(req.params.id, { isDeleted: true });
  console.log("deleted")
        res.json({ success: true, message: 'Product deleted successfully' });

    } catch (error) {
        console.log('deleteProduct error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};


const toggleProductStatus = async (req, res) => {
    try {
        const products = await product.findById(req.params.id);
        products.isActive = !products.isActive;
        await products.save();
        res.json({ 
            success: true, 
            status: products.isActive ? 'Active' : 'Inactive' 
        });
    } catch (error) {
        console.log("error", error);
        res.status(500).json({ success: false, message: 'Something went wrong' });
    }
}





const addVariant = async (req, res) => {
    try {
        const { id } = req.params;
        const { size, color, stock, price } = req.body;
        const images = req.files?.map(file => '/uploads/products/' + file.filename) || [];

        const prod = await product.findById(id);
        if (!prod) return res.status(404).json({ success: false, message: 'Product not found' });

        const sizes = Array.isArray(size) ? size : [size];
        
        sizes.forEach(s => {
            if (s) {
             
                const existingVariant = prod.variants.find(v => v.size === s && v.color === color);
                
                if (existingVariant) {
                 
                    existingVariant.stock += (parseInt(stock) || 0);
                    if (price) existingVariant.price = parseFloat(price);
                    if (images.length > 0) existingVariant.images = images;
                } else {
                    // Add new
                    prod.variants.push({
                        size: s,
                        color,
                        stock: parseInt(stock) || 0,
                        price: parseFloat(price) || 0,
                        images
                    });
                }
            }
        });

        await prod.save();
        res.json({ success: true, message: 'Variant(s) updated/added successfully' });
    } catch (error) {
        console.error('addVariant error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

const editVariant = async (req, res) => {
    try {
        const { productId, variantId } = req.params;
        const { size, color, stock, price } = req.body;
        
        const prod = await product.findById(productId);
        if (!prod) return res.status(404).json({ success: false, message: 'Product not found' });

        const variant = prod.variants.id(variantId);
        if (!variant) return res.status(404).json({ success: false, message: 'Variant not found' });

        variant.size = size;
        variant.color = color;
        variant.stock = parseInt(stock) || 0;
        variant.price = parseFloat(price) || 0;

        if (req.files && req.files.length > 0) {
            variant.images = req.files.map(file => '/uploads/products/' + file.filename);
        }

        await prod.save();
        res.json({ success: true, message: 'Variant updated successfully' });
    } catch (error) {
        console.error('editVariant error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

const deleteVariant = async (req, res) => {
    try {
        const { productId, variantId } = req.params;
        const prod = await product.findById(productId);
        if (!prod) return res.status(404).json({ success: false, message: 'Product not found' });

        prod.variants.pull({ _id: variantId });
        await prod.save();

        res.json({ success: true, message: 'Variant deleted' });
    } catch (error) {
        console.error('deleteVariant error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
}

module.exports = { loadProduct, addProduct, editProduct, deleteProduct, toggleProductStatus, addVariant, editVariant, deleteVariant };

