const Wishlist = require('../models/wishlistSchema');

const attachWishlistCount = async (req, res, next) => {
    try {
        if (req.session?.user?._id) {
            const wishlist = await Wishlist.findOne({ userId: req.session.user._id });
            res.locals.wishlistCount = wishlist ? wishlist.products.length : 0;
        } else {
            res.locals.wishlistCount = 0;
        }
    } catch (error) {
        console.log("wishlist count middleware error:", error);
        res.locals.wishlistCount = 0;
    }
    next();
};

module.exports = attachWishlistCount;
