const mongoose = require('mongoose');

const couponSchema = new mongoose.Schema({
  code:           { type: String, required: true, unique: true, uppercase: true },
  discountType:   { type: String, enum: ['percentage','flat'], required: true },
  discountValue:  { type: Number, required: true },
  minOrderAmount: { type: Number, default: 0 },
  maxDiscountValue: { type: Number, default: 0 },
  maxUsage:       { type: Number, default: 3 },
  usedCount:      { type: Number, default: 0 },
  expiryDate:     { type: Date, required: true },
  isActive:       { type: Boolean, default: true },
}, { timestamps: true });

module.exports = mongoose.model('Coupon', couponSchema);