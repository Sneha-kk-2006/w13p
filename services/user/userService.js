const userRepository = require("../../repositories/user");
const bcrypt = require("bcrypt");
const generateReferralCode=require('../../utils/referralcode')
const walletService = require("../walletService");

const { ERRORS, SUCCESS } = require("../../enums/messages");
const validatePassword = (password) => {
  if (password.length < 8)
    return 'Password must be at least 8 characters';
  if (!/[A-Z]/.test(password))
    return 'Password must contain at least one uppercase letter';
  if (!/[0-9]/.test(password))
    return 'Password must contain at least one number';
  if (!/[!@#$%^&*()_+\-=\[\]{}]/.test(password))
    return 'Password must contain at least one special character';
  return null;
};

const generateOtp = require("../../utils/generateOtp");
const sendVerificationEmail = require("../../utils/sendEmail").sendVerificationEmail;

const emailPattern = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;


const signupWithOtp = async (data, session) => {
  const { name, email, password, confirmpassword, role,referralCode } = data;

  if (!name || !email || !password || !confirmpassword) {
    return { success: false, message: "All fields are required" };
  }

  const trimmedName = name.trim();
  const nameRegex = /^[a-zA-Z\s]{3,50}$/;

  if (!trimmedName || !nameRegex.test(trimmedName)) {
    return { success: false, message: ERRORS.INVALID_NAME };
  }

 const pwdError = validatePassword(password);
 if (pwdError) return { success: false, message: pwdError };

  if (password !== confirmpassword) {
    return { success: false, message: ERRORS.PASSWORD_MISMATCH };
  }

  const [localPart] = email.split('@');
  const repetitiveRegex = /^(.)\1+$/;

  if (!emailPattern.test(email) || repetitiveRegex.test(localPart) || localPart.length < 2) {
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



   if (referralCode && referralCode.trim() !== '') {
    const code = referralCode.trim().toUpperCase();

    // 1. Format check
    const validFormat = /^[A-Z0-9]{6,20}$/.test(code);
    if (!validFormat) {
      return { success: false, message: 'Invalid referral code format' };
    }

    // 2. Exists in DB check
    const referrer = await userRepository.findUserByReferralCode(code);
    if (!referrer) {
      return { success: false, message: 'Referral code not found' };
    }

    // 3. Can't use your own code (check by email)
    if (referrer.email === email) {
      return { success: false, message: 'You cannot use your own referral code' };
    }
  }

  session.auth = {
    otp,
    email,
    name,
    password,
    type: "signup",
    role: role || "user",
     referralCode: referralCode ? referralCode.trim().toUpperCase() : null,
    expiredAt: Date.now() + 1 * 60 * 1000
  };

  console.log("Signup OTP:", otp);

  return { success: true, message: SUCCESS.OTP_SENT };
};

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

  session.user = {
    _id: user._id,
    role: user.role,
  };

  return {
    success: true,
    message: SUCCESS.LOGIN_SUCCESS,
    userId: user._id,
    userData: user
  };
};


const verifyOtpService = async (otp, session, userId) => {
  if (!session.auth) return { success: false, message: ERRORS.SESSION_EXPIRED };




  console.log("expiredAt:", session.auth.expiredAt);
  console.log("Date.now():", Date.now());
  console.log("Expired?:", Date.now() > Number(session.auth.expiredAt));
  console.log("OTP in session:", session.auth.otp);
  console.log("OTP received:", otp);




  if (Date.now() >Number(session.auth.expiredAt) ) return { success: false, message: ERRORS.OTP_EXPIRED };
    if (String(otp) !== String(session.auth.otp)) return { success: false, message: ERRORS.INVALID_OTP };
if (Date.now() > Number(session.auth.expiredAt)) return { success: false, message: ERRORS.OTP_EXPIRED };

  if (session.auth.type === "signup") {
    const { name, email, password, role ,referralCode} = session.auth;
    const passwordHash = await bcrypt.hash(password, 10);


    const newReferralCode = generateReferralCode(name);
    const newUser = await userRepository.createUser({
      name,
      email,
      password: passwordHash,
      role: role || "user",
      referralCode: newReferralCode,
    });
    
    if (referralCode) {
      const referrer = await userRepository.findUserByReferralCode(referralCode);

      if (referrer && referrer._id.toString() !== newUser._id.toString()) {
        // Save who referred this new user
        await userRepository.updateUser(newUser._id, {
          referredByCode: referralCode,
        });
        
        await walletService.credit(referrer._id, 100, `Referral reward for inviting ${newUser.name}`, {
          type: 'credit'
        });

        // Reward the new user with 50 in wallet
        await walletService.credit(newUser._id, 50, `Welcome bonus for using referral code`, {
          type: 'credit'
        });
      }
    }





    delete session.auth;
    return { success: true, redirectUrl: "/login" };
  }

  if (session.auth.type === "forgot") {
      session.auth.otp = null;
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


const resetPasswordService = async (data, session) => {
  const { password, confirmPassword } = data;

  if (!password || !confirmPassword) return { success: false, message: ERRORS.REQUIRED_FIELDS };
  if (password !== confirmPassword) return { success: false, message: ERRORS.PASSWORD_MISMATCH };
  const pwdError = validatePassword(password);
if (pwdError) return { success: false, message: pwdError };

  if (!session.auth || !session.auth.email) return { success: false, message: ERRORS.SESSION_EXPIRED };

  const user = await userRepository.findUserByEmail(session.auth.email);
  if (!user) return { success: false, message: ERRORS.INVALID_CREDENTIALS };

  const hashedPassword = await bcrypt.hash(password, 10);
  await userRepository.updatePasswordByEmail(session.auth.email, hashedPassword);
  delete session.auth;

  return { success: true, message: SUCCESS.PASSWORD_RESET, redirectUrl: "/login" };
};


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

const validateReferralCode = async (code) => {
  if (!code) return { success: false };
  const referrer = await userRepository.findUserByReferralCode(code.toUpperCase());
  return { success: !!referrer };
};

module.exports = {
  signupWithOtp,
  loginUser,
  verifyOtpService,
  forgotPasswordService,
  resetPasswordService,
  resendOtpService,
  validateReferralCode,
};



// const pagination=async(req,res)=>{
// const search=req.query;
// const skip=(page-1)*limit
// const limit=5;
// const totalpages=await product.countDocuments()
// }
