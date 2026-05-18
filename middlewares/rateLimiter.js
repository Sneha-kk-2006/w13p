const rateLimit = require('express-rate-limit');


const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,  // 15 minutes
    max: 5,                     // 5 attempts മാത്രം
    message: {
        success: false,
        message: "Too many login attempts. Please try again after 15 minutes."
    },
    standardHeaders: true,
    legacyHeaders: false,
});

const otpLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,  // 1 hour
    max: 3,                     // 3 attempts മാത്രം
    message: {
        success: false,
        message: "Too many OTP requests. Please try again after 1 hour."
    }
});


const signupLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,  // 1 hour
    max: 5,                     // 5 signups per hour per IP
    message: {
        success: false,
        message: "Too many signup attempts. Please try again later."
    }
});


const apiLimiter = rateLimit({
    windowMs: 60 * 1000,        // 1 minute
    max: 10,                   // 100 requests per minute
    message: {
        success: false,
        message: "Too many requests. Please slow down."
    }
});


const forgotPasswordLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,  // 1 hour
    max: 3,                     // 3 attempts per hour
    message: {
        success: false,
        message: "Too many password reset attempts. Try again after 1 hour."
    }
});

const cartLimiter = rateLimit({
    windowMs: 60 * 1000,        // 1 minute
    max: 30,                    // 30 add-to-cart per minute
    message: {
        success: false,
        message: "Too many requests. Please slow down."
    }
});

module.exports = { 
    loginLimiter, 
    otpLimiter, 
    signupLimiter, 
    apiLimiter,
    forgotPasswordLimiter,
    cartLimiter
};