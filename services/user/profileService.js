const userRepository = require("../../repositories/user");
const User = require("../../models/userSchema");
const bcrypt = require("bcrypt");
const path = require("path");
const fs = require("fs");
const { sendVerificationEmail } = require("../../utils/sendEmail");
const { ERRORS, SUCCESS } = require("../../enums/messages");

// ================== Change Password ==================
const changeUserPassword = async (userId, currentPassword, newPassword, confirmPassword) => {
  if (!currentPassword || !newPassword || !confirmPassword) {
    return { success: false, message: ERRORS.REQUIRED_FIELDS };
  }

  if (newPassword !== confirmPassword) {
    return { success: false, message: ERRORS.PASSWORD_MISMATCH };
  }

  const user = await User.findById(userId).select("+password");
  if (!user) {
    return { success: false, message: ERRORS.USER_NOT_FOUND };
  }

  const isMatch = await bcrypt.compare(currentPassword, user.password);
  if (!isMatch) {
    return { success: false, message: ERRORS.CURRENT_PASSWORD_INCORRECT };
  }

  const isSamePassword = await bcrypt.compare(newPassword, user.password);
  if (isSamePassword) {
    return { success: false, message: ERRORS.NEW_PASSWORD_SAME };
  }

  user.password = await bcrypt.hash(newPassword, 10);
  await user.save();

  return { success: true, message: SUCCESS.PASSWORD_CHANGED };
};

// ================== Update Profile ==================
const updateProfileService = async (req) => {
  const userId = req.session.user?._id;
  if (!userId) return { success: false, redirect: "/login" };

  const user = await userRepository.findById(userId);
  const { name, email, phone } = req.body;

  // ================== Handle Email Change ==================
  if (email && email !== user.email) {
    const otp = Math.floor(100000 + Math.random() * 900000);
    req.session.auth = { otp, email, type: "emailUpdate", expiredAt: Date.now() + 5 * 60 * 1000 };

    // send OTP to both old and new email
    await sendVerificationEmail(user.email, otp);
    await sendVerificationEmail(email, otp);

    return { success: true, redirect: "/verify-otp", message: SUCCESS.OTP_SENT };
  }

  const updateData = { name, email, phone };

  if (req.body.removeProfileImage === "true" && user.profileImage) {
    const oldPath = path.join(__dirname, "../../public", user.profileImage.replace(/^\/+/, ""));
    if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
    updateData.profileImage = null;
  }

if (req.file) {
  const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/jpg", "image/webp"];
  const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2MB

  const filePath = path.join(__dirname, "../../public/uploads", req.file.filename);


  if (!ALLOWED_IMAGE_TYPES.includes(req.file.mimetype)) {
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    return { success: false, message: "Only image files are allowed (jpeg, jpg, png, webp)" };
  }

  if (req.file.size > MAX_FILE_SIZE) {
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    return { success: false, message: "Image size must be under 2MB" };
  }


  if (user.profileImage) {
    const oldPath = path.join(__dirname, "../../public", user.profileImage.replace(/^\/+/, ""));
    if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
  }

  updateData.profileImage = "/uploads/" + req.file.filename;
}
  await userRepository.updateUser(userId, updateData);

  return { success: true, redirect: "/profile", message: SUCCESS.PROFILE_UPDATED };
};

module.exports = { changeUserPassword, updateProfileService };