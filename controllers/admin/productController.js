const product = require('../../models/productSchema');
const category = require('../../models/categorySchema')


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
            .limit(limit)
            .sort({ createdAt: -1 });

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

        const { name, description, image, price, stock, category, size, color } = req.body;

        const images = req.files?.map(file => '/uploads/products/' + file.filename) || [];
        const stockVal = parseInt(stock);
        if (isNaN(stockVal) || stockVal < 0) {
            return res.status(400).json({ success: false, message: 'invalid stock value' })
        }
        const existing = await product.findOne({ name });
        if (existing) {
            return res.status(400).json({ success: false, message: "product already exists" })
        }
        if (price < 0) {
            return res.status(400).json({ success: false, message: "price not negative" })
        }
        if (stock < 0) {
            return res.status(400).json({ success: false, message: "stock not negative" })
        }
        const newProduct = new product({
            name,
            description,
            images,
            price,
            stock: stockVal,
            category,
            size: size || "",
            color: color || "",
            isActive: true,
            isDeleted: false,
            // Create the first variant record automatically for inventory tracking
            variants: [{
                size: size || "One Size",
                color: color || "Default",
                stock: stockVal,
                price: price,
                images: images
            }]
        });

        console.log("new product", newProduct);

        await newProduct.save();
        res.json({ success: true, message: 'Product added and initial variant created' });


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
        const { size, color, stock, price} = req.body;
        console.log(req.body)
        const images = req.files?.map(file => '/uploads/products/' + file.filename) || [];

        const prod = await product.findById(id);
        if (!prod) return res.status(404).json({ success: false, message: 'Product not found' });

        const sizes = Array.isArray(size) ? size : [size];
        const stockVal = parseInt(stock) || 0;
        const priceVal = parseFloat(price) || 0;
        // if (!fabrics) {
        //     return res.status(404).json({ success: false, message: 'fabrics not found' })
        // }
        sizes.forEach(s => {
            if (s) {

                const vIdx = prod.variants.findIndex(v => v.size === s && v.color === color);

                if (vIdx !== -1) {

                    prod.variants[vIdx].stock += stockVal;
                    if (priceVal > 0) prod.variants[vIdx].price = priceVal;
                    if (images.length > 0) prod.variants[vIdx].images = images;
                } else {
                    // Add new
                    prod.variants.push({
                        size: s,
                        color,
                        
                        stock: stockVal,
                        price: priceVal || prod.price,
                        images: images.length > 0 ? images : prod.images
                    });
                }
            }
        });

        //    console.log("debug",prod)
        prod.markModified('variants');
        await prod.save();
        res.json({ success: true, message: 'Variant inventory synchronized' });
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
        // variant.fabrics = fabrics;

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

const setPrimaryImage = async (req, res) => {
    try {
        const { id } = req.params;
        const { src } = req.body;
        const prod = await product.findById(id);
        if (!prod) return res.status(404).json({ success: false, message: 'Product not found' });

        const imgIdx = prod.images.indexOf(src);
        if (imgIdx !== -1) {
            prod.images.splice(imgIdx, 1);
            prod.images.unshift(src);
            await prod.save();
            return res.json({ success: true });
        }
        res.status(400).json({ success: false, message: 'Image not found in product' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
}

const viewVariants = async (req, res) => {
    try {
        const { id } = req.params;
        const prod = await product.findById(id).populate('category');
        if (!prod) return res.redirect('/admin/product');

        res.render('admin/variantList', {
            product: prod
        });
    } catch (error) {
        console.error(error);
        res.redirect('/admin/product');
    }
}

const loadInventory = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 10;
    const skip = (page - 1) * limit;
    const search = req.query.search || "";

    let query = { isDeleted: false };
    if (search) {
      query.name = { $regex: search, $options: "i" };
    }

    const products = await product.find(query)
      .populate("category")
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 });

    const totalProducts = await product.countDocuments(query);
    const totalPages = Math.ceil(totalProducts / limit);

    res.render("admin/inventory", {
      products,
      currentPage: page,
      totalPages,
      search,
    });
  } catch (error) {
    console.error("Error loading inventory:", error);
    res.redirect("/admin/error");
  }
};

module.exports = {
  loadProduct,
  addProduct,
  editProduct,
  deleteProduct,
  toggleProductStatus,
  addVariant,
  editVariant,
  deleteVariant,
  setPrimaryImage,
  viewVariants,
  loadInventory,
};

