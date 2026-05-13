const mongoose = require("mongoose");
const User = require("../../models/userSchema");
const Order = require("../../models/orderSchema");
const Category = require("../../models/categorySchema");
const Product = require("../../models/productSchema");
const bcrypt = require("bcrypt");


const loadlogin = async (req, res) => {
  if (req.session.admin) {
    const admin = await User.findById(req.session.admin);
    if (admin && admin.role === "admin") {
      return res.redirect("/admin/dashboard");
    }
  }
  res.render("admin/login", { message: "" });
};

const login = async (req, res) => {
  try {
    let { email, password } = req.body;
    email = email.trim();
    const admin = await User.findOne({ email: email, role: "admin" });
    if (!admin) {
      return res.render("admin/login", { message: "Admin not found" });
    }

    const isMatch = await bcrypt.compare(password, admin.password);
    console.log("Password Match Result:", isMatch);

    if (!isMatch) {
      console.log("Login failed: Incorrect password");
      return res.render("admin/login", { message: "Invalid password" });
    }

    req.session.admin = admin._id;
    console.log("Setting req.session.admin:", req.session.admin);

    req.session.save((err) => {
      if (err) {
        console.error("Session save error:", err);
        return res.render("admin/login", { message: "Session error" });
      }
      console.log("Session saved successfully. Redirecting to dashboard...");
      res.redirect("/admin/dashboard");
    });

  } catch (error) {
    console.log(error);
    res.redirect("/admin/error");
  }
};


const loadDashboard = async (req, res) => {
  try {
    if (!req.session.admin) {
      return res.redirect("/admin/login");
    }

    const filter = req.query.filter || 'monthly';

    // 1. Summary Stats
    const summaryData = await Order.aggregate([
      { $match: { orderStatus: { $ne: 'Cancelled' } } },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: '$totalPrice' },
          totalOrders: { $sum: 1 }
        }
      }
    ]);

    const summary = summaryData[0] || { totalRevenue: 0, totalOrders: 0 };

    // 2. Best Selling Products (Top 10)
    const topProducts = await Order.aggregate([
      { $match: { orderStatus: { $ne: 'Cancelled' } } },
      { $unwind: '$orderItems' },
      {
        $group: {
          _id: '$orderItems.product',
          totalQty: { $sum: '$orderItems.quantity' },
          revenue: { $sum: { $multiply: ['$orderItems.price', '$orderItems.quantity'] } }
        }
      },
      { $sort: { totalQty: -1 } },
      { $limit: 10 },
      {
        $addFields: {
          pid: { $toObjectId: "$_id" }
        }
      },
      {
        $lookup: {
          from: 'products',
          localField: 'pid',
          foreignField: '_id',
          as: 'productInfo'
        }
      },
      { $unwind: { path: '$productInfo', preserveNullAndEmptyArrays: true } },
      {
        $project: {
          name: { $ifNull: ['$productInfo.name', 'Unknown Product'] },
          image: { $arrayElemAt: ['$productInfo.images', 0] },
          totalQty: 1,
          revenue: 1
        }
      }
    ]);

    // 3. Best Selling Categories (Top 10)
    const topCategories = await Order.aggregate([
      { $match: { orderStatus: { $ne: 'Cancelled' } } },
      { $unwind: '$orderItems' },
      {
        $addFields: {
          productObjectId: { $toObjectId: '$orderItems.product' }
        }
      },
      {
        $lookup: {
          from: 'products',
          localField: 'productObjectId',
          foreignField: '_id',
          as: 'productInfo'
        }
      },
      { $unwind: { path: '$productInfo', preserveNullAndEmptyArrays: true } },
      {
        $group: {
          _id: '$productInfo.category',
          totalQty: { $sum: '$orderItems.quantity' },
          revenue: { $sum: { $multiply: ['$orderItems.price', '$orderItems.quantity'] } },
          repImage: { $first: { $arrayElemAt: ['$productInfo.images', 0] } }
        }
      },
      { $sort: { totalQty: -1 } },
      { $limit: 10 },
      {
        $addFields: {
          cid: { $toObjectId: "$_id" }
        }
      },
      {
        $lookup: {
          from: 'categories',
          localField: 'cid',
          foreignField: '_id',
          as: 'categoryInfo'
        }
      },
      { $unwind: { path: '$categoryInfo', preserveNullAndEmptyArrays: true } },
      {
        $project: {
          name: { $ifNull: ['$categoryInfo.name', 'Uncategorized'] },
          totalQty: 1,
          revenue: 1,
          image: { $ifNull: ['$categoryInfo.image', '$repImage'] }
        }
      }
    ]);

    // 4. Sales Data for Chart
    let groupBy = {};
    if (filter === 'weekly') {
      groupBy = { year: { $year: '$createdAt' }, week: { $week: '$createdAt' } };
    } else if (filter === 'monthly') {
      groupBy = { year: { $year: '$createdAt' }, month: { $month: '$createdAt' } };
    } else {
      groupBy = { year: { $year: '$createdAt' } };
    }

    const salesData = await Order.aggregate([
      { $match: { orderStatus: { $ne: 'Cancelled' } } },
      {
        $group: {
          _id: groupBy,
          revenue: { $sum: '$totalPrice' }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1, '_id.week': 1 } }
    ]);

    res.render("admin/dashboard", {
      summary,
      topProducts,
      topCategories,
      salesData,
      filter
    });

  } catch (error) {
    console.error("Dashboard Error:", error);
    res.render("admin/error");
  }
};

const loadsales = async (req, res) => {
  try {
    res.render("admin/salesreport");
  } catch (error) {
    console.error("Load sales error:", error);
  }
};

const loaduser = async (req, res) => {
  try {
    let search = req.query.search || "";
    let page = parseInt(req.query.page) || 1;
    let limit = 5;

    let query = {
      role: "user",
      $or: [
        { name: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
      ]


    };

    const [users, totalPages] = await Promise.all([
      User.find(query)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      User.countDocuments(query),
    ]);

    res.render("admin/usermanagement", {
      users,
      totalPages: Math.ceil(totalPages / limit),
      currentPage: page,
      search,
    });
  } catch (error) {
    console.log(error);
    res.render("admin/error");
  }
};



const blockUser = async (req, res) => {
  try {
    const id = req.query.id;
    await User.updateOne(
      { _id: id },
      { $set: { isBlocked: true } }
    );
    res.redirect("/admin/usermanagement");
  } catch (error) {
    console.log(error);
  }
};



const unblockUser = async (req, res) => {
  try {
    const id = req.query.id;
    await User.updateOne(
      { _id: id },
      { $set: { isBlocked: false } }
    );
    res.redirect("/admin/usermanagement");
  } catch (error) {
    console.log(error);
  }
};

const loaderror = async (req, res) => {
  res.render("admin/error");
};

const logout = async (req, res) => {
  try {
    req.session.admin = null;
    res.redirect("/admin/login");
  } catch (error) {
    console.log(error);
    res.redirect("/admin/error");
  }
};

module.exports = {
  loadlogin,
  login,
  loadDashboard,
  loadsales,
  loaduser,
  loaderror,
  blockUser,
  unblockUser,
  logout,
};
