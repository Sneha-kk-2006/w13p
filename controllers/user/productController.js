const Product = require('../../models/productSchema');
const Category = require('../../models/categorySchema');
const Review = require('../../models/reviewSchema');
const Wishlist = require('../../models/wishlistSchema');
const Offer = require('../../models/offerSchema');
const mongoose = require('mongoose');
const Order = require('../../models/orderSchema');


const getBestOffer = async (productId, categoryId) => {
  const now = new Date();

  const offers = await Offer.find({
    isActive: true,
    startDate: { $lte: now },
    endDate: { $gte: now },
    $or: [
      { offerType: 'product', product: productId },
      { offerType: 'category', category: categoryId }
    ]
  });

  return offers.reduce((best, offer) => {
    return (offer.discount > (best?.discount || 0)) ? offer : best;
  }, null);
};


const calcOfferPrice = (regularPrice, offer) => {
  if (!offer || !regularPrice) return { offerPrice: null, discountPercent: null };

  const discountAmount = (regularPrice * offer.discount) / 100;
  const offerPrice = Math.round(regularPrice - discountAmount);
  const discountPercent = offer.discount;

  return { offerPrice, discountPercent };
};


const attachOffers = async (products) => {
  return Promise.all(products.map(async (product) => {
    const p = product.toObject ? product.toObject() : product;
    const offer = await getBestOffer(p._id, p.category?._id);
    const { offerPrice, discountPercent } = calcOfferPrice(p.price, offer);
    return { ...p, offer, offerPrice, discountPercent };
  }));
};


const getProducts = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 8;
    const skip = (page - 1) * limit;

    const activeCategories = await Category.find({ isDeleted: false, status: 'Active' }).select('_id');
    const activeCategoryIds = activeCategories.map(cat => cat._id);

    const filter = {
      isDeleted: { $ne: true },
      isActive: { $ne: false },
      category: { $in: activeCategoryIds }
    };

    const totalProducts = await Product.countDocuments(filter);
    const totalPages = Math.ceil(totalProducts / limit);

    const rawProducts = await Product.find(filter)
      .populate('category')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    let wishlistProductIds = [];
    const userId = req.session.user?._id;
    if (userId) {
      const wishlist = await Wishlist.findOne({ userId });
      if (wishlist) {
        wishlistProductIds = wishlist.products.map(p => p.productId.toString());
      }
    }

    const products = await attachOffers(rawProducts);

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
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.redirect('/products');
    }

    const product = await Product.findById(req.params.id).populate('category');
    if (!product || product.isDeleted || !product.isActive || (product.category && product.category.status !== 'Active')) {
      return res.redirect('/products');
    }

    const activeCats = await Category.find({ isDeleted: false, status: 'Active' }).select('_id');
    const activeCatIds = activeCats.map(c => c._id);

    // Related: same category first, then fallback
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

    if (relatedProducts.length < 4) {
      const extra = await Product.find({
        _id: { $ne: product._id, $nin: relatedProducts.map(p => p._id) },
        category: { $in: activeCatIds },
        isDeleted: { $ne: true },
        isActive: { $ne: false }
      }).populate('category').limit(8 - relatedProducts.length);
      relatedProducts = [...relatedProducts, ...extra];
    }

  
    const reviews = await Review.find({ productId: product.id }).populate('userId', 'name');
    const avgRating = reviews.length
      ? (reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length).toFixed(1)
      : 0;

    // Compute offer for THIS product
    const bestOffer = await getBestOffer(product._id, product.category?._id);
    const { offerPrice, discountPercent } = calcOfferPrice(product.price, bestOffer);

    // Attach offers to related products too
    const relatedWithOffers = await attachOffers(relatedProducts);

    // Check if this product is in user's wishlist
    let wishlistProductIds = [];
    const userId = req.session.user?._id;
    if (userId) {
      const wishlist = await Wishlist.findOne({ userId });
      if (wishlist) {
        wishlistProductIds = wishlist.products
          .filter(p => p.productId)
          .map(p => p.productId.toString());
      }
    }

    let canRate = false;
    let userReview = null;

    if (userId) {
      const deliveredOrder = await Order.findOne({
        userId,
        "orderItems.product": product._id,
        "orderItems.status": "Delivered",
      });
      canRate = !!deliveredOrder;

      // check if user already reviewed
      userReview = product.ratings.find(r => r.user && r.user.toString() === userId.toString()) || null;
    }

    res.render('user/productDetails', {
      product,
      relatedProducts: relatedWithOffers,
      reviews,
      avgRating,
      offer: bestOffer,
      offerPrice,
      discountPercent,
      wishlistProductIds,
      isLoggedIn: !!userId,
      canRate,     
      userReview, 
    });

  } catch (error) {
    console.error("loadProductDetails error:", error);
    res.redirect('/products');
  }
};


const rateProduct = async (req, res) => {
  try {
    const { productId } = req.params;
    const { rating, review } = req.body;
    const userId = req.session.user._id || req.session.user;

    // validate rating
    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({ success: false, message: "Rating must be between 1 and 5" });
    }
    
    if (review && review.trim().length > 500) {
        return res.status(400).json({ success: false, message: "Review must be under 500 characters" });
    }
    const cleanReview = review ? review.trim() : "";

    // check user has a delivered order containing this product
    const hasDelivered = await Order.findOne({
      userId,
      orderStatus: "Delivered",
      "orderItems.product": productId,
      "orderItems.status": "Delivered",
    });

    if (!hasDelivered) {
      return res.status(403).json({ success: false, message: "You can only rate products you have purchased and received" });
    }

    const product = await Product.findById(productId);
    if (!product) return res.status(404).json({ success: false, message: "Product not found" });

    // check if already rated
    const existingIndex = product.ratings.findIndex(
      r => r.user.toString() === userId.toString()
    );

    if (existingIndex !== -1) {
      // update existing rating
      product.ratings[existingIndex].rating = rating;
      product.ratings[existingIndex].review = cleanReview;
    } else {
      // add new rating
      product.ratings.push({ user: userId, rating, review: cleanReview });
    }

    // recalculate average
    const total = product.ratings.reduce((sum, r) => sum + r.rating, 0);
    product.averageRating = parseFloat((total / product.ratings.length).toFixed(1));
    product.totalRatings  = product.ratings.length;

    await product.save();

    return res.json({
      success: true,
      message: "Rating submitted",
      averageRating: product.averageRating,
      totalRatings: product.totalRatings,
    });

  } catch (error) {
    console.error("rateProduct error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

const submitReview = async (req, res) => {
  try {
    const { productId } = req.params;
    const { rating, review } = req.body;
    const userId = req.session.user?._id || req.session.user;

    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({ success: false, message: "Rating must be between 1 and 5" });
    }

    if (review && review.trim().length > 500) {
        return res.status(400).json({ success: false, message: "Review must be under 500 characters" });
    }
    const cleanReview = review ? review.trim() : "";

    // must have a delivered order
    const deliveredOrder = await Order.findOne({
      userId,
      "orderItems.product": productId,
      "orderItems.status": "Delivered",
    });

    if (!deliveredOrder) {
      return res.status(403).json({ success: false, message: "You can only review products you have received" });
    }

    // upsert — update if exists, create if not
    await Review.findOneAndUpdate(
      { productId, userId },
      { rating: Number(rating), review: cleanReview, createdAt: new Date() },
      { upsert: true, new: true }
    );

    return res.json({ success: true, message: "Review submitted successfully" });

  } catch (error) {
    console.error("submitReview error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};


const deleteReview = async (req, res) => {
  try {
    const { productId } = req.params;
    const userId = req.session.user?._id || req.session.user;

    await Review.findOneAndDelete({ productId, userId });

    return res.json({ success: true, message: "Review deleted" });
  } catch (error) {
    console.error("deleteReview error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};
module.exports = { getProducts, getBestOffer, loadProductDetails, attachOffers, calcOfferPrice ,rateProduct,submitReview,deleteReview};