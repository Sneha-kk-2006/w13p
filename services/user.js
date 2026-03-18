const user = require("../models/userSchema");

const findUserByEmail = async (email) => {
  return await user.findOne({ email });
};

const createUser = async (userData) => {
  const newUser = new user(userData);
  return await newUser.save();
};

const findById = async (_id) => {
  return await user.findById(_id).select("-password").lean();
};

module.exports = {
  findUserByEmail,
  createUser,
  findById,
};
