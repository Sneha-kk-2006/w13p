const user = require("../models/userSchema");
const Address = require("../models/addressSchema");

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


const updateUser = async (id, updateData) => {
  return await user.findByIdAndUpdate(id, updateData, { new: true });
  
};

const updatePasswordByEmail = async (email, password) => {
  return await user.findOneAndUpdate({ email }, { password });
};

const createAddress = async (data) => {
  return await Address.create(data);
};

const findByUserId = (userId) => {
  return Address.find({ userId: userId });
};

const findByIdAndUser = (addressId, userId) => {
  return Address.findOne({ _id: addressId, userId });
};

const updateByIdAndUser = (addressId, userId, data) => {
  return Address.findOneAndUpdate(
    { _id: addressId, userId: userId }, 
    data,
    { returnDocument: "after" }
  );
};



module.exports = {
  findUserByEmail,
  createUser,
  findById,
  updateUser,
  updatePasswordByEmail,
  createAddress,
  findByUserId,
  findByIdAndUser,
  updateByIdAndUser,
   
};
