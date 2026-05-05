const Coupon = require('../../models/couponSchema');

const loadCoupons = async (req, res) => {
    try {
        const search = req.query.search || '';
        const query = search ? { code: { $regex: search, $options: 'i' } } : {};
        const coupons = await Coupon.find(query).sort({ createdAt: -1 });
        res.render('admin/coupons', { coupons, search });
    } catch (error) {
        console.error('Error loading coupons:', error);
        res.status(500).render('admin/error', { message: 'Failed to load coupons' });
    }
};

const addCoupon = async (req, res) => {
    try {
        const { code, discountPercentage, expiryDate, minPurchase, maxDiscount } = req.body;
        
        // Basic backend validation
        if (!code || !discountPercentage || !expiryDate) {
            return res.status(400).json({ success: false, msg: "All fields are required" });
        }

        const existing = await Coupon.findOne({ code: code.toUpperCase() });
        if (existing) {
            return res.status(400).json({ success: false, msg: "Coupon code already exists" });
        }

        const newCoupon = new Coupon({
            code: code.toUpperCase(),
            discountType: 'percentage',
            discountValue: discountPercentage,
            minOrderAmount: minPurchase,
            maxDiscountValue: maxDiscount,
            expiryDate: new Date(expiryDate),
            isActive: true
        });


        await newCoupon.save();
        res.json({ success: true, msg: "Coupon created successfully" });
    } catch (error) {
        console.error('Error adding coupon:', error);
        res.status(500).json({ success: false, msg: "Internal server error" });
    }
};

const deleteCoupon = async (req, res) => {
    try {
        const { id } = req.params;
        await Coupon.findByIdAndDelete(id);
        res.json({ success: true, msg: "Coupon deleted successfully" });
    } catch (error) {
        console.error('Error deleting coupon:', error);
        res.status(500).json({ success: false, msg: "Internal server error" });
    }
};

module.exports = {
    loadCoupons,
    addCoupon,
    deleteCoupon
};
