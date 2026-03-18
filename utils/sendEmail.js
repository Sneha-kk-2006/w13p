const nodemailer = require("nodemailer");
require("dotenv").config();

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.NODEMAILER_EMAIL,
    pass: process.env.NODEMAILER_PASSWORD,
  },
});

const sendVerificationEmail = async (email, otp) => {
  try {
    const info = await transporter.sendMail({
      from: `"SNOVA Store" <${process.env.NODEMAILER_EMAIL}>`,
      to: email,
      subject: "Verify Your Account",
      text: `Your OTP is ${otp}`,
    });

    return info.accepted.length > 0;
  } catch (error) {
    console.log("Email error", error);
    return false;
  }
};

const sendOtp = async (email, otp) => {
  try {
    const info = await transporter.sendMail({
      from: `"SNOVA Store" <${process.env.NODEMAILER_EMAIL}>`,
      to: email,
      subject: "OTP for Profile Update",
      text: `Your OTP for updating your profile is ${otp}`,
    });

    return info.accepted.length > 0;
  } catch (error) {
    console.log("Email error", error);
    return false;
  }
};

module.exports = {
  sendVerificationEmail,
  sendOtp,
};