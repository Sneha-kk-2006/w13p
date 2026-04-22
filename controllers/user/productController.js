const Product = require('../../models/productSchema');
const Category = require('../../models/categorySchema');
const Review = require('../../models/reviewSchema');
const Wishlist = require('../../models/wishlistSchema');



const getProducts = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 8;
    const skip = (page - 1) * limit;

    // Get active category IDs first
    const activeCategories = await require('../../models/categorySchema').find({
      isDeleted: false,
      status: 'Active'
    }).select('_id');
    const activeCategoryIds = activeCategories.map(cat => cat._id);

    const filter = {
      isDeleted: { $ne: true },
      isActive: { $ne: false },
      category: { $in: activeCategoryIds }
    };

    const totalProducts = await Product.countDocuments(filter);
    const totalPages = Math.ceil(totalProducts / limit);

    const products = await Product.find(filter)
      .populate('category')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    // Get wishlist IDs for heart icon state
    let wishlistProductIds = [];
    const userId = req.session.user?._id;
    if (userId) {
      const wishlist = await Wishlist.findOne({ userId });
      if (wishlist) {
        wishlistProductIds = wishlist.products.map(p => p.productId.toString());
      }
    }

    res.render('user/products', {
      products,
      wishlistProductIds,
      isLoggedIn: !!userId,
      currentPage: page,
      totalPages,
      totalProducts
    });
  } catch (err) {
    console.error(err);
    res.redirect('/');
  }
};



const loadProductDetails = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id).populate('category')
    console.log("product ", product)
    if (!product || product.isDeleted || !product.isActive || (product.category && product.category.status !== 'Active')) {
      return res.redirect('/products')
    }

    const activeCats = await Category.find({ isDeleted: false, status: 'Active' }).select('_id');
    const activeCatIds = activeCats.map(c => c._id);

    // 1st Attempt: Same Category
    let relatedProducts = [];
    if (product.category) {
        relatedProducts = await Product.find({
            category: product.category._id,
            _id: { $ne: product._id },
            isDeleted: { $ne: true },
            isActive: { $ne: false }
        }).populate('category').limit(8);
    }

    const firstAttemptCount = relatedProducts.length;

    // 2nd Attempt Fallback: Any active products from active categories
    if (relatedProducts.length < 4) {
        const extra = await Product.find({
            _id: { $ne: product._id, $nin: relatedProducts.map(p => p._id) },
            category: { $in: activeCatIds },
            isDeleted: { $ne: true },
            isActive: { $ne: false }
        }).populate('category').limit(8 - relatedProducts.length);
        relatedProducts = [...relatedProducts, ...extra];
    }

    console.log('--- DISCOVERY LOGS ---');
    console.log('Product:', product.name);
    console.log('Category:', product.category?.name);
    console.log('1st Attempt (Same Cat):', firstAttemptCount);
    console.log('Total Discovery Count:', relatedProducts.length);
    console.log('----------------------');

    const reviews = await Review.find({ productId: product.id }).populate('userId', 'name')
    const avgRating = reviews.length ? (reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length).toFixed(1) : 0;

    res.render('user/productDetails', {
      product,
      relatedProducts,
      reviews,
      avgRating,
    })

  } catch (error) {
    console.error(error);
    res.redirect('/products');
  }
}



module.exports = { getProducts, loadProductDetails };