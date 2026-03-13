const User = require("../../models/userSchema");
const mongoose = require("mongoose");
const bcrypt = require("bcrypt");

const loadlogin = (req, res) => {
  if (req.session.admin) {
    return res.render("admin/dashboard");
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
        req.session.admin = true;
        return res.redirect("/admin/dashboard");
      } else {
        return res.redirect("/admin/login");
      }
    } else {
      return res.redirect("/admin/login");
    }
  } catch (error) {
    console.log("log error", error);
    return res.redirect("error");
  }
};

const loadDashboard = async (req, res) => {
  if (req.session.admin) {
    try {
      res.render("admin/dashboard");
    } catch (error) {
      res.render("/admin/error");
    }
  }
};

const loadsales = async (req, res) => {
  try {
    res.render("admin/salesreport");
  } catch (error) {}
};
const loaduser = async (req, res) => {
  try {
    let search = req.query.search || "";
    let page = parseInt(req.query.page) || 1;
    let limit = 5;

    let query = {
      isAdmin: false,
      name: { $regex: search, $options: "i" },
    };

    const totalUsers = await User.countDocuments(query);

    const users = await User.find(query)
      .sort({ createdAt: -1 }) // latest first
      .skip((page - 1) * limit)
      .limit(limit);

    res.render("admin/usermanagement", {
      users,
      totalPages: Math.ceil(totalUsers / limit),
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
      {
        $set: { isBlocked: true },
      },
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
      {
        $set: { isBlocked: false },
      },
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
