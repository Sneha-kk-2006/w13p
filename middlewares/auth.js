const User = require("../models/userSchema");
const mongoose = require("mongoose");

const userAuth = (req, res, next) => {
  if (req.session.user) {
    User.findById(req.session.user)
      .then((data) => {
        if (data && !data.isBlocked) {
           res.locals.user = data;
          next();
        } else {
          res.redirect("/login");
        }
      })
      .catch((error) => {
        console.log("error occurred in user auth middleware");
        res.status(500).send("internal server error");
      });
  } else {
    res.redirect("/login");
  }
};

const adminAuth = async (req, res, next) => {
  console.log("SESSION IN MIDDLEWARE:", req.session);
  try {
    if (req.session.admin) {
     
const userData = await User.findById(req.session.admin);
      if (userData && userData.role==="admin") {
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
      const user = await User.findById(req.session.user);

      if (user && user.isBlocked) {
        req.session.destroy();
        return res.redirect("/login");
      }

      res.locals.user = user; // ✅ passes user to navbar on public pages
    } else {
      res.locals.user = null; // ✅ shows Login button when not logged in
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

