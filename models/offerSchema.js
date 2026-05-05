const mongoose = require('mongoose');

const offerSchema = new mongoose.Schema({
  name:        { type: String, required: true },
  offerType:   { type: String, enum: ['product','category','referral'], required: true },
  product:     { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
  category:    { type: mongoose.Schema.Types.ObjectId, ref: 'Category' },
  discount:    { type: Number, required: true, min: 0, max: 100 },
  startDate:   { type: Date, required: true },
  endDate:     { type: Date, required: true },
  isActive:    { type: Boolean, default: true },
}, { timestamps: true });

module.exports = mongoose.model('Offer', offerSchema);