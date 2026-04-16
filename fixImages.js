const mongoose = require('mongoose');
const product = require('./models/productSchema');
require('dotenv').config();

mongoose.connect(process.env.MONGODB_URI)
    .then(async () => {
        const products = await product.find({ images: { $exists: true } });

        for (const p of products) {
            p.images = p.images.map(img =>
                img.startsWith('/uploads') ? img : '/uploads/products/' + img
            );
            await p.save();
        }

        console.log('All image paths fixed!');
        mongoose.disconnect();
    });