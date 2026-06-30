
const product=require('../../models/productSchema')
const category=require('../../models/categorySchema')
const Wishlist = require('../../models/wishlistSchema')

const mongoose=require('mongoose')
const { attachOffers } = require('./productController');

const loadcat = async (req, res) => {
    try {
        const search      = req.query.search     || '';
        const sort        = req.query.sort        || '';
        const categoryId  = req.query.category    || '';
        const minPrice    = req.query.minPrice    || '';
        const maxPrice    = req.query.maxPrice    || '';
        const currentPage = parseInt(req.query.page) || 1;
        const limit       = 8;
        const skip        = (currentPage - 1) * limit;
        // Get active category IDs first
        const activeCategories = await category.find({ 
            isDeleted: false, 
            status: 'Active' 
        });
        const activeCategoryIds = activeCategories.map(cat => cat._id.toString());

        // Product query
        let query = { 
            isDeleted: { $ne: true }, 
            isActive: { $ne: false },
            category: { $in: activeCategoryIds }
        };

        if (search) query.name = { $regex: search, $options: 'i' };
        
        if (categoryId && mongoose.Types.ObjectId.isValid(categoryId)) {
            // Check if specified category is active
            if (activeCategoryIds.includes(categoryId.toString())) {
                query.category = new mongoose.Types.ObjectId(categoryId);
            }
        }
        // Fetch products matching category and search (without price database filter)
        const products = await product.find(query).populate('category');
        const productsWithOffers = await attachOffers(products);

        // Calculate actual selling price for each product
        let processedProducts = productsWithOffers.map(p => {
            const sellingPrice = p.offerPrice || Math.round(p.price - (p.price * (p.discount || 0) / 100));
            return { ...p, sellingPrice };
        });

        // Filter by min/max price based on sellingPrice
        if (minPrice || maxPrice) {
            processedProducts = processedProducts.filter(p => {
                if (minPrice && p.sellingPrice < parseInt(minPrice)) return false;
                if (maxPrice && p.sellingPrice > parseInt(maxPrice)) return false;
                return true;
            });
        }

        // Sort by sellingPrice, name, or date
        if (sort === 'price-low') {
            processedProducts.sort((a, b) => a.sellingPrice - b.sellingPrice);
        } else if (sort === 'price-high') {
            processedProducts.sort((a, b) => b.sellingPrice - a.sellingPrice);
        } else if (sort === 'az') {
            processedProducts.sort((a, b) => a.name.localeCompare(b.name));
        } else if (sort === 'za') {
            processedProducts.sort((a, b) => b.name.localeCompare(a.name));
        } else {
            processedProducts.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        }

        const total = processedProducts.length;
        const paginatedProducts = processedProducts.slice(skip, skip + limit);

        const categories = await category.find({ isDeleted: false, status: 'Active' });

        const totalPages = Math.ceil(total / limit);

        // Get user's wishlist product IDs for heart icon state
        let wishlistProductIds = [];
        const userId = req.session.user?._id;
        if (userId) {
            const wishlist = await Wishlist.findOne({ userId });
            if (wishlist) {
                wishlistProductIds = wishlist.products.map(p => p.productId.toString());
            }
        }

        res.render('user/category', {
            products: paginatedProducts,
            categories,  
            search,
            sort,
            categoryId,
            minPrice,
            maxPrice,
            currentPage,
            totalPages,
            limit,
            wishlistProductIds,
            isLoggedIn: !!userId
        });



    } catch (error) {
        console.log(error);
        res.status(500).send('Server Error');
    }
};

module.exports = { loadcat };
