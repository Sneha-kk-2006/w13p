const userRepository = require("../../repositories/user");
const product=require('../../models/productSchema')
const category=require('../../models/categorySchema')

const mongoose=require('mongoose')
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

        // Product query
        let query = { isDeleted: false, isActive: true };
        console.log(query)
        if (search)    query.name     = { $regex: search, $options: 'i' };
if (categoryId && mongoose.Types.ObjectId.isValid(categoryId)) {
    query.category = new mongoose.Types.ObjectId(categoryId);
}
        if (minPrice || maxPrice) {
            query.price = {};
            if (minPrice) query.price.$gte = parseInt(minPrice);
            if (maxPrice) query.price.$lte = parseInt(maxPrice);
        }

 
        let sortOption = { createdAt: -1 };
        if (sort === 'price-low')  sortOption = { price:  1 };
        if (sort === 'price-high') sortOption = { price: -1 };
        if (sort === 'az')         sortOption = { name:   1 };
        if (sort === 'za')         sortOption = { name:  -1 };

        const total    = await product.countDocuments(query);
        const products = await product.find(query)
            .populate('category')
            
            .sort(sortOption)
            .skip(skip)
            .limit(limit);
         

console.log(products)

        const categories = await category.find({ isDeleted: false });

        const totalPages = Math.ceil(total / limit);

        res.render('user/category', {
            products,
            categories,  
            search,
            sort,
            categoryId,
            minPrice,
            maxPrice,
            currentPage,
            totalPages,
            limit
        });


        // Test 1: no filters at all
// const all = await product.find({});
// console.log('All products:', all.length);

// // Test 2: only isDeleted
// const notDeleted = await product.find({ isDeleted: false });
// console.log('Not deleted:', notDeleted.length);

// // Test 3: only isActive
// const active = await product.find({ isActive: true });
// console.log('Active:', active.length);

    } catch (error) {
        console.log(error);
        res.status(500).send('Server Error');
    }
};

module.exports = { loadcat };