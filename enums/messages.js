const ERRORS = {
  INVALID_CREDENTIALS: "Invalid email or password",
  USER_EXISTS: "User already exists",
  USER_BLOCKED: "User is blocked",
  INVALID_EMAIL: "Invalid email format",
  EMAIL_FAILED: "Failed to send email",
  PASSWORD_MISMATCH: "Passwords do not match",
  REQUIRED_FIELDS: "All fields are required",
  SESSION_EXPIRED: "Session expired",
  OTP_EXPIRED: "OTP expired",
  INVALID_OTP: "Invalid OTP",
  INVALID_REQUEST: "Invalid request",
  PASSWORD_LENGTH: "Password must be at least 6 characters",
  OTP_RESENT: "OTP resent successfully"
};

const SUCCESS = {
  OTP_SENT: "OTP sent successfully",
  LOGIN_SUCCESS: "Login successful",
  PASSWORD_RESET: "Password updated successfully"
};

module.exports = { ERRORS, SUCCESS };