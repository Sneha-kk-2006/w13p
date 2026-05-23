const Coupon = require("../../models/couponSchema");

const loadCoupons = async (req, res) => {
  try {
    const search = req.query.search || "";
    const query = search ? { code: { $regex: search, $options: "i" } } : {};
    const coupons = await Coupon.find(query).sort({ createdAt: -1 });

    res.render("admin/coupons", { coupons, search });
  } catch (error) {
    console.error("Error loading coupons:", error);
    res
      .status(500)
      .render("admin/error", { message: "Failed to load coupons" });
  }
};

const addCoupon = async (req, res) => {
  try {
    const { code, discountPercentage, expiryDate, minPurchase, maxDiscount } =
      req.body;

    if (!code || !discountPercentage || !expiryDate) {
      return res
        .status(400)
        .json({ success: false, msg: "All fields are required" });
    }

    if (!/^[A-Z0-9]{3,20}$/.test(code.toUpperCase())) {
      return res
        .status(400)
        .json({
          success: false,
          msg: "Code must be 3-20 alphanumeric characters",
        });
    }

    const discVal = parseFloat(discountPercentage);
    const minVal = parseFloat(minPurchase) || 0;
    const maxVal = parseFloat(maxDiscount) || 0;
    const expDate = new Date(expiryDate);

    if (isNaN(discVal) || discVal <= 0 || discVal > 100) {
      return res
        .status(400)
        .json({ success: false, msg: "Invalid discount percentage (1-100)" });
    }
    if (minVal <= 0) {
      return res
        .status(400)
        .json({
          success: false,
          msg: "Minimum purchase must be greater than 0",
        });
    }
    if (maxVal <= 0) {
      return res
        .status(400)
        .json({ success: false, msg: "Max discount must be greater than 0" });
    }
    if (maxVal >= minVal) {
      return res
        .status(400)
        .json({
          success: false,
          msg: "Max discount must be less than minimum purchase amount",
        });
    }
    if (expDate <= new Date()) {
      return res
        .status(400)
        .json({ success: false, msg: "Expiry date must be in the future" });
    }

    const existing = await Coupon.findOne({ code: code.toUpperCase() });
    if (existing) {
      return res
        .status(400)
        .json({ success: false, msg: "Coupon code already exists" });
    }

    const newCoupon = new Coupon({
      code: code.toUpperCase(),
      discountType: "percentage",
      discountValue: discountPercentage,
      minOrderAmount: minPurchase,
      maxDiscountValue: maxDiscount,
      expiryDate: new Date(expiryDate),
      isActive: true,
    });

    await newCoupon.save();
    res.json({ success: true, msg: "Coupon created successfully" });
  } catch (error) {
    console.error("Error adding coupon:", error);
    res.status(500).json({ success: false, msg: "Internal server error" });
  }
};

const deleteCoupon = async (req, res) => {
  try {
    const { id } = req.params;
    await Coupon.findByIdAndDelete(id);
    res.json({ success: true, msg: "Coupon deleted successfully" });
  } catch (error) {
    console.error("Error deleting coupon:", error);
    res.status(500).json({ success: false, msg: "Internal server error" });
  }
};

const toggleCouponStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const coupon = await Coupon.findById(id);
    if (!coupon) {
      return res.status(404).json({ success: false, msg: "Coupon not found" });
    }
    coupon.isActive = !coupon.isActive;
    await coupon.save();
    res.json({
      success: true,
      msg: `Coupon ${coupon.isActive ? "activated" : "deactivated"} successfully`,
    });
  } catch (error) {
    console.error("Error toggling coupon status:", error);
    res.status(500).json({ success: false, msg: "Internal server error" });
  }
};

module.exports = {
  loadCoupons,
  addCoupon,
  deleteCoupon,
  toggleCouponStatus,
};
