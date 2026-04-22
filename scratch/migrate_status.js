const mongoose = require('mongoose');
const Category = require('./models/categorySchema');
const Product = require('./models/productSchema');
require('dotenv').config();

async function migrate() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/snova'); // fallback if env not loaded
    console.log("Connected to DB");

    const categoryResult = await Category.updateMany(
      { isDeleted: false, status: { $exists: false } },
      { $set: { status: 'Active' } }
    );
    console.log(`Updated ${categoryResult.modifiedCount} categories to Active`);

    const productResult = await Product.updateMany(
      { isDeleted: false, isActive: { $exists: false } },
      { $set: { isActive: true } }
    );
    console.log(`Updated ${productResult.modifiedCount} products to Active`);

    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

migrate();
