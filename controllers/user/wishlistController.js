const Wishlist = require('../../models/wishlistSchema');
const Product = require('../../models/productSchema');

const getWishlist = async (req, res) => {
    try {
        const userId = req.session.user?._id;
        if (!userId) {
            return res.redirect('/login');
        }

        let wishlist = await Wishlist.findOne({ userId }).populate('products.productId');
        
        if (!wishlist) {
            wishlist = new Wishlist({ userId, products: [] });
            await wishlist.save();
        }
        // Filter out any products that were deleted from the database
        wishlist.products = wishlist.products.filter(p => p.productId != null);
        
        let sortedWishlist = wishlist.products.sort((a,b) => {
            return b.productId._id.getTimestamp() - a.productId._id.getTimestamp();
        });

        res.render('user/wishlist', { 
            wishlist:sortedWishlist,
            pageTitle: 'My Wishlist'
        });

    } catch (err) {
        console.error('getWishlist error:', err);
        res.status(500).send('Server Error');
    }
};

const addToWishlist = async (req, res) => {
    try {
        const userId = req.session.user?._id;
        const { productId } = req.body;

        if (!userId) {
            return res.json({ success: false, msg: 'Please login first' });
        }

        let wishlist = await Wishlist.findOne({ userId });
        if (!wishlist) {
            wishlist = new Wishlist({ userId, products: [] });
        }

        const productExists = wishlist.products.some(p => p.productId.toString() === productId);
        if (productExists) {
            return res.json({ success: false, msg: 'Product already in wishlist' });
        }

        wishlist.products.push({ productId });
        await wishlist.save();

        res.json({ 
            success: true, 
            msg: 'Product added to wishlist',
            wishlistCount: wishlist.products.length
        });


    } catch (err) {
        console.error('addToWishlist error:', err);
        res.status(500).json({ success: false, msg: 'Server Error' });
    }
};

const removeFromWishlist = async (req, res) => {
    try {
        const userId = req.session.user?._id;
        const { productId } = req.body;

        if (!userId) {
            return res.json({ success: false, msg: 'Unauthorized' });
        }

        const wishlist = await Wishlist.findOne({ userId });
        if (!wishlist) {
            return res.json({ success: false, msg: 'Wishlist not found' });
        }

        wishlist.products = wishlist.products.filter(p => p.productId.toString() !== productId);
        await wishlist.save();

        res.json({ 
            success: true, 
            msg: 'Product removed from wishlist',
            wishlistCount: wishlist.products.length
        });


    } catch (err) {
        console.error('removeFromWishlist error:', err);
        res.status(500).json({ success: false, msg: 'Server Error' });
    }
};

module.exports = { getWishlist, addToWishlist, removeFromWishlist };