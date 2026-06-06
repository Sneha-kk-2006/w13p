const mongoose = require("mongoose");
const { Schema } = mongoose;
const userSchema = new Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String },
    googleId: { type: String, unique: true, sparse: true },

    isBlocked: { type: Boolean, default: false },

    role: {
      type: String,
      enum: ["user", "admin"],
      default:'user',
    },
    orders:{type: mongoose.Schema.ObjectId,ref:'Order'},
    profileImage: { type: String, default: "" },
    loginAttempts: { type: Number, default: 0 },
    phone: { type: String, default: "" },
      referralCode:    { type: String, unique: true,sparse:true, },   
  referredByCode:  { type: String, default: null },  // code they entered at signup
  credits:         { type: Number, default: 0 },  

  },
   
  { timestamps: true }

);

const User = mongoose.model("User", userSchema);

module.exports = User;