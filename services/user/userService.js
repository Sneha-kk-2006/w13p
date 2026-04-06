const userRepository = require("../../repositories/user");
const bcrypt = require("bcrypt");
const { ERRORS, SUCCESS } = require("../../enums/messages");

const generateOtp = require("../../utils/generateOtp");
const sendVerificationEmail = require("../../utils/sendEmail").sendVerificationEmail;

const emailPattern = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

// ================= SIGNUP =================
const signupWithOtp = async (data, session) => {
  const { name, email, password, confirmpassword, role } = data;

  if (!name || !email || !password || !confirmpassword) {
    return { success: false, message: ERRORS.REQUIRED_FIELDS };
  }

  if (password !== confirmpassword) {
    return { success: false, message: ERRORS.PASSWORD_MISMATCH };
  }

  if (!emailPattern.test(email)) {
    return { success: false, message: ERRORS.INVALID_EMAIL };
  }

  const existingUser = await userRepository.findUserByEmail(email);
  if (existingUser) {
    return { success: false, message: ERRORS.USER_EXISTS };
  }

  const otp = generateOtp();
  const emailSent = await sendVerificationEmail(email, otp);

  if (!emailSent) {
    return { success: false, message: ERRORS.EMAIL_FAILED };
  }

  session.auth = {
    otp,
    email,
    name,
    password,
    type: "signup",
    role: role || "user", // default role is user
    expiredAt: Date.now() + 5 * 60 * 1000
  };

  console.log("Signup OTP:", otp);

  return { success: true, message: SUCCESS.OTP_SENT };
};

// ================= LOGIN =================
const loginUser = async (data, session) => {
  const { email, password } = data;

  if (!email || !password) {
    return { success: false, message: ERRORS.INVALID_CREDENTIALS };
  }

  const user = await userRepository.findUserByEmail(email);

  if (!user || user.isBlocked) {
    return { success: false, message: ERRORS.INVALID_CREDENTIALS };
  }

  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) {
    return { success: false, message: ERRORS.INVALID_CREDENTIALS };
  }

  // attach user info in session for role-based auth
  session.user = {
    _id: user._id,
    role: user.isAdmin ? "admin" : "user",
  };

  return {
    success: true,
    message: SUCCESS.LOGIN_SUCCESS,
    userId: user._id,
    userData: user
  };
};

// ================= OTP VERIFICATION =================
const verifyOtpService = async (otp, session, userId) => {
  if (!session.auth) return { success: false, message: ERRORS.SESSION_EXPIRED };
  if (Date.now() > session.auth.expiredAt) return { success: false, message: ERRORS.OTP_EXPIRED };
  if (String(otp) !== String(session.auth.otp)) return { success: false, message: ERRORS.INVALID_OTP };

  if (session.auth.type === "signup") {
    const { name, email, password, role } = session.auth;
    const passwordHash = await bcrypt.hash(password, 10);

    await userRepository.createUser({
      name,
      email,
      password: passwordHash,
      isAdmin: role === "admin" ? true : false,
    });

    delete session.auth;
    return { success: true, redirectUrl: "/login" };
  }

  if (session.auth.type === "forgot") {
    return { success: true, redirectUrl: "/resetPassword" };
  }

  if (session.auth.type === "emailUpdate") {
    const { email } = session.auth;
    await userRepository.updateUser(userId, { email });
    delete session.auth;
    return { success: true, redirectUrl: "/profile" };
  }

  return { success: false, message: ERRORS.INVALID_REQUEST };
};

// ================= FORGOT PASSWORD =================
const forgotPasswordService = async (email, session) => {
  if (!emailPattern.test(email)) return { success: false, message: ERRORS.INVALID_EMAIL };

  const user = await userRepository.findUserByEmail(email);
  if (!user) return { success: true }; // don't reveal if email exists

  const otp = generateOtp();
  const emailSent = await sendVerificationEmail(email, otp);
  if (!emailSent) return { success: false, message: ERRORS.EMAIL_FAILED };

  session.auth = { otp, email, type: "forgot", expiredAt: Date.now() + 5 * 60 * 1000 };
  console.log("Forgot OTP:", otp);

  return { success: true, message: SUCCESS.OTP_SENT };
};

// ================= RESET PASSWORD =================
const resetPasswordService = async (data, session) => {
  const { password, confirmPassword } = data;

  if (!password || !confirmPassword) return { success: false, message: ERRORS.REQUIRED_FIELDS };
  if (password !== confirmPassword) return { success: false, message: ERRORS.PASSWORD_MISMATCH };
  if (password.length < 6) return { success: false, message: ERRORS.PASSWORD_LENGTH };

  if (!session.auth || !session.auth.email) return { success: false, message: ERRORS.SESSION_EXPIRED };

  const user = await userRepository.findUserByEmail(session.auth.email);
  if (!user) return { success: false, message: ERRORS.INVALID_CREDENTIALS };

  const hashedPassword = await bcrypt.hash(password, 10);
  await userRepository.updatePasswordByEmail(session.auth.email, hashedPassword);
  delete session.auth;

  return { success: true, message: SUCCESS.PASSWORD_RESET };
};

// ================= RESEND OTP =================
const resendOtpService = async (session) => {
  if (!session.auth) return { success: false, message: ERRORS.SESSION_EXPIRED };

  const otp = generateOtp();
  session.auth.otp = otp;
  session.auth.expiredAt = Date.now() + 5 * 60 * 1000;

  const emailSent = await sendVerificationEmail(session.auth.email, otp);
  if (!emailSent) return { success: false, message: ERRORS.EMAIL_FAILED };

  console.log("Resent OTP:", otp);
  return { success: true, message: SUCCESS.OTP_RESENT };
};

module.exports = {
  signupWithOtp,
  loginUser,
  verifyOtpService,
  forgotPasswordService,
  resetPasswordService,
  resendOtpService,
};