const user = require("../../models/userSchema");
const bcrypt = require("bcrypt");
const userService = require("../../services/user");
const generateOtp = require("../../utils/generateOtp");
const { sendVerificationEmail } = require("../../utils/sendEmail");
const hashPassword = require("../../utils/hashPassword");

require("dotenv").config();



const loadHomepage = async (req, res) => {
  try {
    const id = req.session.user;
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



const errorPage = async (req, res) => {
  try {
    res.render("user/errorPage");
  } catch (error) {
    res.redirect("/errorPage");
  }
};



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



const signup = async (req, res) => {
  try {
    const { name, email, password, confirmpassword } = req.body;

    if (password !== confirmpassword) {
      return res.json({ success: false, message: "Passwords do not match" });
    }

    const existingUser = await userService.findUserByEmail(email);

    if (existingUser) {
      return res.json({ success: false, message: "User already exists" });
    }
    const gmailPattern = /^[a-zA-Z][a-zA-Z0-9._%+-]{2,}@gmail\.com$/;

    if (!gmailPattern.test(email)) {
      return res.json({
        success: false,
        message: "Enter a valid Gmail (no special invalid characters allowed)",
      });
    }

    const otp = generateOtp();
    const emailSent = await sendVerificationEmail(email, otp);

    if (!emailSent) {
      return res.json({ success: false, message: "Email sending failed" });
    }

    req.session.auth = {
      otp,
      email,
      name,
      password,
      type: "signup",
    };

    console.log("Signup OTP:", otp);

    res.json({ success: true, message: "OTP sent successfully" });
  } catch (error) {
    console.error("Signup error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};


const verifyOtp = async (req, res) => {
  console.log("Verify OTP Request Body:", req.body);
  try {
    const { otp } = req.body;
    console.log(otp);
    if (!req.session.auth) {
      return res.json({ success: false, message: "OTP expired" });
    }

    const sessionOtp = req.session.auth.otp;

    if (String(otp) !== String(sessionOtp)) {
      return res.json({ success: false, message: "Invalid OTP" });
    }

    if (req.session.auth.type === "signup") {
      const { name, email, password } = req.session.auth;
      const passwordHash = await hashPassword(password);

      await userService.createUser({
        name,
        email,
        password: passwordHash,
      });

      delete req.session.auth;

      return res.json({
        success: true,
        redirectUrl: "/login",
      });
    }

    if (req.session.auth.type === "forgot") {
      return res.json({
        success: true,
        redirectUrl: "/resetPassword",
      });
    }

    if (req.session.auth.type === "emailUpdate") {
      const { email } = req.session.auth;
      const userId = req.session.user;

      await user.findByIdAndUpdate(userId, { email });

      delete req.session.auth;

      return res.json({
        success: true,
        redirectUrl: "/profile",
      });
    }
  } catch (error) {
    console.error("Verify OTP error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};


const resendOtp = async (req, res) => {
  try {
    if (!req.session.auth) {
      return res.json({ success: false, message: "Session expired" });
    }

    const otp = generateOtp();
    req.session.auth.otp = otp;

    const emailSent = await sendVerificationEmail(req.session.auth.email, otp);

    if (!emailSent) {
      return res.json({ success: false, message: "Failed to resend OTP" });
    }

    console.log("Resent OTP:", otp);
    res.json({ success: true, message: "OTP resent successfully" });
  } catch (error) {
    console.error("Resend OTP error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};



const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const findUser = await userService.findUserByEmail(email);

    if (!findUser) {
      return res.json({ success: false, message: "User not found" });
    }

    if (findUser.isBlocked) {
      return res.json({ success: false, message: "User blocked by admin" });
    }

    const passwordMatch = await bcrypt.compare(password, findUser.password);

    if (!passwordMatch) {
      return res.json({ success: false, message: "Incorrect password" });
    }

    const userData = await userService.findById(findUser._id);

    req.session.user = findUser._id;
    res.locals.user = userData;
    res.json({ success: true, redirectUrl: "/" });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};



const loadforgot = (req, res) => {
  try {
    if (req.session.user) {
      return res.redirect("/");
    }
    res.render("user/forgotPassword");
  } catch (error) {
    console.error("Forgot page error:", error);
  }
};

const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    const emailPattern = /^[a-zA-Z0-9._%+-]+@gmail\.com$/;
    if (!emailPattern.test(email)) {
      return res.json({ success: false, message: "Invalid email format" });
    }
  
    
    const findUser = await userService.findUserByEmail(email);
    console.log(findUser);
    if (!findUser) {
      return res.render("user/forgotPassword", { message: "Email not found" });
    }

    const otp = generateOtp();
    const emailSent = await sendVerificationEmail(email, otp);
    console.log("Forgot Password OTP:", otp);
    if (!emailSent) {
      return res.render("user/forgotPassword", {
        message: "Email sending failed",
      });
    }
    

    req.session.auth = {
      otp,
      email,
      type: "forgot",
    };

    console.log("Forgot Password OTP:", otp);
    res.render("user/verify-otp");
  } catch (error) {
    console.error("Forgot password error:", error);
  }
};



const loadVerify = (req, res) => {
  try {
    if (!req.session.auth) {
      if (req.session.user) {
        return res.redirect("/profile");
      }
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
    const { password, confirmPassword } = req.body;

    if (!password || !confirmPassword) {
      return res.render("user/resetPassword", {
        message: "All fields are required",
      });
    }

    if (password !== confirmPassword) {
      return res.render("user/resetPassword", {
        message: "Passwords do not match",
      });
    }

    if (password.length < 6) {
      return res.render("user/resetPassword", {
        message: "Password must be at least 6 characters",
      });
    }

    const email = req.session.auth.email;
    const findUser = await user.findOne({ email });

    if (!findUser) {
      return res.redirect("/login");
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    findUser.password = hashedPassword;
    await findUser.save();

    delete req.session.auth;
    res.redirect("/login");
  } catch (error) {
    console.error("Reset Password Error:", error);
    res.redirect("/errorPage");
  }
};

const loadproducts = async (req, res) => {
  try {
    res.render("user/products");
  } catch (error) {
    console.error("Load products error:", error);
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
};
