const Product = require('../../models/productSchema');
const Category = require('../../models/categorySchema');
const Review = require('../../models/reviewSchema');
const Wishlist = require('../../models/wishlistSchema');
const Offer = require('../../models/offerSchema');


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

    console.log('--- DISCOVERY LOGS ---');
    console.log('Product:', product.name);
    console.log('Category:', product.category?.name);
    console.log('1st Attempt (Same Cat):', firstAttemptCount);
    console.log('Total Discovery Count:', relatedProducts.length);
    console.log('----------------------');

    const reviews = await Review.find({ productId: product.id }).populate('userId', 'name');
    const avgRating = reviews.length
      ? (reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length).toFixed(1)
      : 0;

    // Compute offer for THIS product
    const bestOffer = await getBestOffer(product._id, product.category?._id);
    const { offerPrice, discountPercent } = calcOfferPrice(product.price, bestOffer);

    // Attach offers to related products too
    const relatedWithOffers = await attachOffers(relatedProducts);

    res.render('user/productDetails', {
      product,
      relatedProducts: relatedWithOffers,
      reviews,
      avgRating,
      offer: bestOffer,
      offerPrice,
      discountPercent
    });

  } catch (error) {
    console.error(error);
    res.redirect('/products');
  }
};


module.exports = { getProducts, getBestOffer, loadProductDetails, attachOffers, calcOfferPrice };