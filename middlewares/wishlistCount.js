const Wishlist = require('../models/wishlistSchema');

const attachWishlistCount = async (req, res, next) => {
    try {
        if (req.session?.user?._id) {
            const wishlist = await Wishlist.findOne({ userId: req.session.user._id }).populate({
                path: 'products.productId',
                populate: { path: 'category' }
            });
            
            if (wishlist && wishlist.products) {
                const availableProducts = wishlist.products.filter(p => 
                    p.productId && 
                    p.productId.isActive !== false && 
                    p.productId.isDeleted !== true &&
                    (!p.productId.category || (p.productId.category.isActive !== false && p.productId.category.isDeleted !== true))
                );
                res.locals.wishlistCount = availableProducts.length;
            } else {
                res.locals.wishlistCount = 0;
            }
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
