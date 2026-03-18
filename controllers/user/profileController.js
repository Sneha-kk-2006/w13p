const User = require("../../models/userSchema");
const fs = require("fs");
const path = require("path");
const { sendOtp } = require("../../utils/sendEmail");
const authController = require("./auth.controller");
const bcrypt = require("bcrypt");

const loadprofile = async (req, res) => {
  try {
    const userId = req.session.user;
    const userData = await User.findById(userId);

    res.render("user/profile", { user: userData });
  } catch (error) {
    console.error("error occurred", error);
    res.redirect("/errorPage");
  }
};

const updateProfile = async (req, res) => {
  try {
    const userId = req.session.user;

    if (!userId) {
      return res.redirect("/login");
    }


    const user = await User.findById(userId);
    const { name, email, phone } = req.body;

    // EMAIL CHANGE → OTP FLOW
    if (email !== user.email) {
      const otp = Math.floor(100000 + Math.random() * 900000);

      req.session.auth = {
        otp,
        email,
        type: "emailUpdate",
      };

      await sendOtp(user.email, otp);
      await sendOtp(email, otp);

      console.log(`OTP sent to ${user.email} and ${email}: ${otp}`);

      return res.redirect(303, "/verify-otp");
    }

    let updateData = {
      name,
      email,
      phone,
    };

    // REMOVE PROFILE IMAGE
    if (req.body.removeProfileImage === "true" && user.profileImage) {
      const oldPath = path.join(
        __dirname,
        "../../public",
        user.profileImage.replace(/^\/+/, ""),
      );
      if (fs.existsSync(oldPath)) {
        fs.unlinkSync(oldPath);
      }

      updateData.profileImage = null;
    }

    // UPLOAD NEW IMAGE
    if (req.file) {
      if (user.profileImage) {
        const oldPath = path.join(__dirname, "../../public", user.profileImage);

        if (fs.existsSync(oldPath)) {
          fs.unlinkSync(oldPath);
        }
      }

      updateData.profileImage = "/uploads/" + req.file.filename;
    }

    await User.findByIdAndUpdate(userId, updateData);
    res.redirect("/profile");
  } catch (err) {
    console.error(err);
    res.redirect("/profile");
  }
};

const loadChangePassword = async (req, res) => {
  try {
    res.render("user/changePassword");
  } catch (error) {
    console.error("Error loading change password page:", error);
    res.redirect("/profile");
  }
};

const changePassword = async (req, res) => {
  try {
    const userId = req.session.user;
    const { currentPassword, newPassword, confirmPassword } = req.body;

    if (newPassword !== confirmPassword) {
      return res.render("user/changePassword", {
        message: "New passwords do not match",
      });
    }

    const user = await User.findById(userId);
    const isMatch = await bcrypt.compare(currentPassword, user.password);

    if (!isMatch) {
      return res.render("user/changePassword", {
        message: "Current password is incorrect",
      });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    user.password = hashedPassword;

    await user.save();
    console.log("Password changed successfully");
    res.redirect("user/profile");
  } catch (error) {
    console.error("Error changing password:", error);
    res.redirect("/profile");
  }
};

const logout = async (req, res) => {
  try {
    req.session.destroy((err) => {
      if (err) {
        console.error("Logout error:", err);
      }
      res.redirect("/login");
    });
  } catch (error) {
    console.error("Error during logout:", error);
    res.redirect("/profile");
  }
};

module.exports = {
  loadprofile,
  updateProfile,
  loadChangePassword,
  changePassword,
  logout,
};
