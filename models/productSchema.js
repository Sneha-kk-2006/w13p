const mongoose = require("mongoose");

const variantSchema = new mongoose.Schema({
  size: { type: String, required: true },
  color: { type: String, required: true },

  stock: { type: Number, default: 0 },
  price: { type: Number, default: 0 },
  images: [String]
});



const ratingSchema = new mongoose.Schema({
  user:      { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  rating:    { type: Number, required: true, min: 1, max: 5 },
  review:    { type: String, trim: true },
  createdAt: { type: Date, default: Date.now },
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
    ratings:       [ratingSchema],
  averageRating: { type: Number, default: 0 },
  totalRatings:  { type: Number, default: 0 },
    category: { type: mongoose.Schema.Types.ObjectId, ref: 'category' },
    images: [String],
    size: { type: String, default: "" },
    color: { type: String, default: "" },
    fabrics: { type: String, default: "" },
    variants: [variantSchema],
    stock: {
      type: Number,
      default: 0
    },
    isActive: { type: Boolean, default: true },
    isDeleted: { type: Boolean, default: false },
    isListed: { type: Boolean, default: true },
    createdAt: {
      type: Date,
      default: Date.now
    }
  },
  { timestamps: true }
);



module.exports = mongoose.model("Product", productSchema);