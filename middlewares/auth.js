const User = require("../models/userSchema");
const mongoose = require("mongoose");

const userAuth = (req, res, next) => {
  if (req.session.user) {
    User.findById(req.session.user)
      .then((data) => {
        if (data && !data.isBlocked) {
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

// const User = require("../models/userSchema");
// const { ERRORS } = require("../enums/messages");


// const userAuth = async (req, res, next) => {
//   try {
//     if (!req.session.user) {
//       return res.redirect("/login");
//     }

//     const user = await User.findById(req.session.user._id);

//     if (!user || user.isBlocked) {
//       req.session.destroy();
//       return res.redirect("/login");
//     }

//     req.user = user; // attach user object for later use
//     next();
//   } catch (error) {
//     console.log("Error in userAuth middleware:", error);
//     res.status(500).send("Internal server error");
//   }
// };


// const adminAuth = async (req, res, next) => {
//   try {
//     if (!req.session.admin) {
//       return res.redirect("/admin/login");
//     }

//     const user = await User.findById(req.session.admin);
//     console.log(user);
//     if (!user || user.isAdmin === false) {
//       return res.redirect("/admin/login");
//     }

//     if (user.isBlocked) {
//       req.session.destroy();
//       return res.redirect("/login");
//     }

//     req.user = user;
//     next();
//   } catch (error) {
//     console.log("Error in adminAuth middleware:", error);
//     res.status(500).send("Internal server error");
//   }
// };


// const isUser = async (req, res, next) => {
//   try {
//     if (req.session.user) {
//       const user = await User.findById(req.session.user._id);

//       if (user && user.isBlocked) {
//         req.session.destroy();
//         return res.redirect("/login");
//       }
//     }

//     next();
//   } catch (error) {
//     console.log("Error in isUser middleware:", error);
//     res.redirect("/login");
//   }
// };



// const isAuth = (req, res, next) => {
//   if (req.session.user) {
//     return res.redirect("/");
//   }
//   next();
// };

// module.exports = { userAuth, adminAuth, isUser, isAuth };
