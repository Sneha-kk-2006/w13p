const Product = require('../../models/productSchema');
const Review = require('../../models/reviewSchema');
const Wishlist = require('../../models/wishlistSchema');



const getProducts = async (req, res) => {
  try {
    const products = await Product.find({
      isDeleted: { $ne: true },
      isActive: { $ne: false }
    }).populate('category');

    // Get wishlist IDs for heart icon state
    let wishlistProductIds = [];
    const userId = req.session.user?._id;
    if (userId) {
      const wishlist = await Wishlist.findOne({ userId });
      if (wishlist) {
        wishlistProductIds = wishlist.products.map(p => p.productId.toString());
      }
    }

    res.render('user/products', { products, wishlistProductIds, isLoggedIn: !!userId });
  } catch (err) {
    console.error(err);
    res.redirect('/');
  }
};



const loadProductDetails = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id).populate('category')
    console.log("product ", product)
    if (!product || product.isDeleted || !product.isActive) {
      return res.redirect('/products')
    }

    const relatedProducts = product.category ? await Product.find({
      category: product.category._id,
      _id: { $ne: product._id },
      isDeleted: { $ne: true },
      isActive: { $ne: false }
    }).limit(4) : [];


    console.log(relatedProducts)
    const reviews = await Review.find({ productId: product.id }).populate('userId', 'name')

    const avgRating = reviews.length ? (reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length).toFixed(1) : 0;

    res.render('user/productDetails', {
      product,
      relatedProducts,
      reviews,
      avgRating,
      user: req.session.user,


    })

  } catch (error) {
    console.error(error);
    res.redirect('/products');
  }
}



module.exports = { getProducts, loadProductDetails };