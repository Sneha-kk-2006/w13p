const mongoose = require("mongoose");

const variantSchema = new mongoose.Schema({
  size:  { type: String, required: true },
  color: { type: String, required: true },
  stock: { type: Number, default: 0 },
  price: { type: Number, default: 0 },
  images: [String]
});

const productSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true
    },
    description: {
      type: String,
      required: true
    },
    price: {
      type: Number,
    },
    discount: {
      type: Number,
      default: 0
    },
    category: { type: mongoose.Schema.Types.ObjectId, ref: 'category' },
    images: [String],
    size: { type: String, default: "" },
    color: { type: String, default: "" },
    variants: [variantSchema],
    stock: {
      type: Number,
      default: 0
    },
    isActive:  { type: Boolean, default: true  },
    isDeleted: { type: Boolean, default: false },
    isListed:  { type: Boolean, default: true },
    createdAt: {
      type: Date,
      default: Date.now
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model("Product", productSchema);