const User = require("../../models/userSchema");
const mongoose = require("mongoose");

const bcrypt = require("bcrypt");

const loadlogin = async (req, res) => {
  if (req.session.admin) {
    const admin = await User.findById(req.session.admin);
    if (admin && admin.isAdmin) {
      return res.redirect("/admin/dashboard");
    }
  }
  res.render("admin/login", { message: null });
};

const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const admin = await User.findOne({ email, isAdmin: true });
    if (admin) {
      const passwordMatch = await bcrypt.compare(password, admin.password);
      if (passwordMatch) {
        req.session.admin = admin._id;
        return res.redirect("/admin/dashboard");
      } else {
        return res.render("admin/login", { message: "Invalid password" });
      }
    } else {
      return res.render("admin/login", { message: "Admin not found" });
    }
  } catch (error) {
    console.log("log error", error);
    return res.redirect("/admin/error");
  }
};

const loadDashboard = async (req, res) => {
  try {
    res.render("admin/dashboard");
  } catch (error) {
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
      isAdmin: false,
      $or:[
       {name: { $regex: search, $options: "i" }},
       {email: { $regex: search, $options: "i" }},
      ]
      
      
    };

    const [users , totalPages] = await Promise.all([
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

module.exports = {
  loadlogin,
  login,
  loadDashboard,
  loadsales,
  loaduser,
  loaderror,
  blockUser,
  unblockUser,
};
