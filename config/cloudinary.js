const cloudinary = require("cloudinary").v2;
require('dotenv').config()

cloudinary.config({
  cloud_name: "dlqqrgjqh",
  api_key: "process.env",
  api_secret: "your_api_secret",
});

module.exports = cloudinary;