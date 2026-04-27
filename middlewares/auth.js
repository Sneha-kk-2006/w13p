const User = require("../models/userSchema");
const mongoose = require("mongoose");

const userAuth = async (req, res, next) => {
  if (req.session.user) {
    const userId = typeof req.session.user === "object" ? req.session.user._id : req.session.user;
    
    try {
      const data = await User.findById(userId);
      if (data && !data.isBlocked) {
        res.locals.user = data;
        next();
      } else {
        res.redirect("/login");
      }
    } catch (error) {
      console.error("error occurred in user auth middleware:", error);
      res.status(500).send("internal server error");
    }
  } else {
    res.redirect("/login");
  }
};

const adminAuth = async (req, res, next) => {
  try {
    if (req.session.admin) {
      const userData = await User.findById(req.session.admin);
      if (userData && userData.role === "admin") {
        return next();
      }
    }
    res.redirect("/admin/login");
  } catch (error) {
    console.log("error in admin auth middleware", error);
    res.status(500).send("internal server error");
  }
};

const isUser = async (req, res, next) => {
  try {
    if (req.session.user) {
      const userId = typeof req.session.user === "object" ? req.session.user._id : req.session.user;
      const user = await User.findById(userId);

      if (user && user.isBlocked) {
        req.session.destroy();
        return res.redirect("/login");
      }

      res.locals.user = user;
    } else {
      res.locals.user = null;
    }

    next();
  } catch (error) {
    console.log(error);
    res.redirect("/login");
  }
};

const isAuth = (req, res, next) => {
  if (req.session.user) {
    return res.redirect("/");
  }
  next();
};

module.exports = { userAuth, isAuth, adminAuth, isUser };

