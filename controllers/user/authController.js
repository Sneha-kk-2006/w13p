const user = require("../../models/userSchema");
const authService = require("../../services/user/userService");
const ERROR = require('../../enums/messages');

require("dotenv").config();

// ================== Homepage ==================
const loadHomepage = async (req, res) => {
  try {
    const id = req.session.user?._id;
    if (id) {
      const userData = await user.findById(id);
      res.render("user/home", { user: userData });
    } else {
      return res.render("user/home", { user: null });
    }
  } catch (error) {
    console.error("Home page error:", error);
    res.status(500).send("Server Error");
  }
};

// ================== Error Page ==================
const errorPage = async (req, res) => {
  try {
    res.render("user/errorPage");
  } catch (error) {
    console.error("Error page render failed:", error);
    res.redirect("/errorPage");
  }
};

// ================== Signup & Login Pages ==================
const loadsignup = (req, res) => {
  try {
    res.render("user/signup");
  } catch (error) {
    console.error("Signup page error:", error);
    res.render("user/errorPage");
  }
};

const loadlogin = (req, res) => {
  try {
    res.render("user/login");
  } catch (error) {
    console.error("Login page error:", error);
    res.status(500).send("Server error");
  }
};

// ================== Signup ==================
const signup = async (req, res) => {
  try {
    const result = await authService.signupWithOtp(req.body, req.session);

    if (!result.success) {
      return res.status(400).json({ success: false, message: result.message });
    }

    return res.status(200).json({ success: true, message: result.message });
  } catch (error) {
    console.error("Signup error:", error);
    res.status(500).json({ success: false, message: ERROR.SERVER_ERROR });
  }
};

// ================== Verify OTP ==================
const verifyOtp = async (req, res) => {
  try {
    const { otp } = req.body;
    const result = await authService.verifyOtpService(otp, req.session, req.session.user?._id);

    if (!result.success) {
      return res.json({ success: false, message: result.message });
    }

    return res.json({ success: true, redirectUrl: result.redirectUrl });
  } catch (error) {
    console.error("Verify OTP error:", error);
    return res.status(500).json({ success: false, message: ERROR.SERVER_ERROR });
  }
};

// ================== Resend OTP ==================
const resendOtp = async (req, res) => {
  try {
    const result = await authService.resendOtpService(req.session);
    return res.json(result);
  } catch (error) {
    console.error("Resend OTP error:", error);
    return res.status(500).json({ success: false, message: ERROR.SERVER_ERROR });
  }
};

// ================== Login ==================
const login = async (req, res) => {
  try {
    const result = await authService.loginUser(req.body, req.session);

    if (!result.success) {
      return res.status(400).json({ success: false, message: result.message });
    }
    req.session.user = {
      _id: result.userId,
      role: result.userData.isAdmin ? "admin" : "user",
    };
    res.locals.user = result.userData;

    return res.json({ success: true, redirectUrl: "/" });
  } catch (error) {
    console.error("Login error:", error);
    return res.status(500).json({ success: false, message: ERROR.SERVER_ERROR });
  }
};



const loadforgot = (req, res) => {
  try {
    if (req.session.user) return res.redirect("/");
    res.render("user/forgotPassword");
  } catch (error) {
    console.error("Forgot page error:", error);
  }
};

const forgotPassword = async (req, res) => {
  try {
    const result = await authService.forgotPasswordService(req.body.email, req.session);

    if (!result.success) {
      return res.render("user/forgotPassword", { message: result.message });
    }

    return res.render("user/verify-otp");
  } catch (error) {
    console.error("Forgot password error:", error);
    return res.status(500).render("user/forgotPassword", { message: ERROR.SERVER_ERROR });
  }
};


const loadVerify = (req, res) => {
  try {
    if (!req.session.auth) {
      if (req.session.user) return res.redirect("/profile");
      return res.redirect("/signup");
    }
    res.render("user/verify-otp");
  } catch (error) {
    console.error("Load verify page error:", error);
  }
};


const loadreset = async (req, res) => {
  try {
    res.render("user/resetPassword");
  } catch (error) {
    console.error("Load reset error:", error);
  }
};

const resetPassword = async (req, res) => {
  try {
    const result = await authService.resetPasswordService(req.body, req.session);

    if (!result.success) {
      if (result.redirect) return res.redirect(result.redirect);
      return res.render("user/resetPassword", { message: result.message });
    }

    return res.redirect(result.redirect);
  } catch (error) {
    console.error("Reset Password Error:", error);
    return res.redirect("/errorPage");
  }
};





const loadproducts = async (req, res) => {
  try {
    res.render("user/products");
  } catch (error) {
    console.error("Load products error:", error);
  }
};

const googleAuth = (req, res, next) => {
  next(); // passport will handle redirect
};

const googleCallback = (req, res) => {
  try {
    if (!req.user) {
      return res.redirect("/signup");
    }

    const role = req.user.isAdmin ? "admin" : "user";

    req.session.user = {
      _id: req.user._id,
      role: role,
    };

    console.log("SESSION SET:", req.session.user);

    req.session.save((err) => {
      if (err) {
        console.error("Session Save Error:", err);
        return res.redirect("/errorPage");
      }

      console.log("SESSION SAVED");
      return res.redirect("/");
    });

  } catch (error) {
    console.error("Google Callback Error:", error);
    return res.redirect("/errorPage");
  }
};







module.exports = {
  loadHomepage,
  errorPage,
  loadsignup,
  loadlogin,
  signup,
  verifyOtp,
  resendOtp,
  login,
  loadVerify,
  loadforgot,
  forgotPassword,
  loadreset,
  resetPassword,
  loadproducts,
    googleAuth,
  googleCallback,
};