const addressRepository = require("../../repositories/user");
const Address = require("../../models/addressSchema");



const getUserAddresses = async (userId) => {
  console.log("Fetching addresses for user:", userId);
  if (!userId) {
    return { success: false, redirect: "/login" };
  }

  const addresses = await addressRepository.findByUserId(userId);

  return {
    success: true,
    addresses,
  };
};





const addAddressService = async (data, userId) => {
  const {
    fullName,
    phone,
    type,
    addressline1,
    addressline2,
    country,
    city,
    state,
    pincode,
    redirect = "/address"
  } = data;

  console.log("Adding address for user:", userId, data);
  if (!userId) {
    return { success: false, redirect: "/login" };
  }

  const trimmedName = fullName.trim();
  if (!trimmedName || !phone || !addressline1 || !city || !state || !pincode) {
    return { success: false, message: "Required fields missing" };
  }

  const nameRegex = /^[a-zA-Z\s]{3,50}$/;
  const phoneRegex = /^[6-9]\d{9}$/;
  const pincodeRegex = /^\d{6}$/;

  if (!nameRegex.test(trimmedName) || trimmedName.length < 3) {
    console.log("Validation failed: Invalid name (too short or contains numbers/symbols)", fullName);
    return { success: false, message: "Invalid name. Use only letters (min 3 chars)." };
  }

  if (!phoneRegex.test(phone)) {
    console.log("Validation failed: Invalid phone", phone);
    return { success: false, message: "Invalid phone number. Must be 10 digits starting with 6-9." };
  }

  if (!pincodeRegex.test(pincode)) {
    console.log("Validation failed: Invalid pincode", pincode);
    return { success: false, message: "Invalid pincode. Must be exactly 6 digits." };
  }

  await addressRepository.createAddress({
    userId,
    fullName: trimmedName,
    phone,
    type,
    addressline1,
    addressline2,
    country,
    city,
    state,
    pincode,
  });

  return {
    success: true,
    redirect: redirect,
  };
};

const getEditAddress = async (addressId, userId) => {
  if (!userId) {
    return { success: false, redirect: "/login" };
  }

  const address = await addressRepository.findByIdAndUser(addressId, userId);

  if (!address) {
    return { success: false, redirect: "/address" };
  }

  return {
    success: true,
    address,
  };
};



const updateAddressService = async (data, userId) => {
  if (!userId) {
    return { success: false, redirect: "/login" };
  }

  const {
    id,
    fullName,
    phone,
    type,
    addressline1,
    addressline2,
    country,
    city,
    state,
    pincode,
    redirect = "/address"
  } = data;

  const trimmedName = fullName.trim();
  if (!trimmedName || !phone || !addressline1 || !city || !state || !pincode) {
    return { success: false, message: "Required fields missing" };
  }

  const nameRegex = /^[a-zA-Z\s]{3,50}$/;
  const phoneRegex = /^[6-9]\d{9}$/;
  const pincodeRegex = /^\d{6}$/;

  if (!nameRegex.test(trimmedName) || trimmedName.length < 3) {
    console.log("Validation failed: Invalid name (too short or contains numbers/symbols)", fullName);
    return { success: false, message: "Invalid name. Use only letters (min 3 chars)." };
  }

  if (!phoneRegex.test(phone)) {
    console.log("Validation failed: Invalid phone", phone);
    return { success: false, message: "Invalid phone number. Must be 10 digits starting with 6-9." };
  }

  if (!pincodeRegex.test(pincode)) {
    console.log("Validation failed: Invalid pincode", pincode);
    return { success: false, message: "Invalid pincode. Must be exactly 6 digits." };
  }

  const updatedAddress = await addressRepository.updateByIdAndUser(id, userId, {
    fullName: trimmedName,
    phone,
    type,
    addressline1,
    addressline2,
    country,
    city,
    state,
    pincode,
  });

  if (!updatedAddress) {
    return { success: false, redirect: "/address" };
  }

  return {
    success: true,
    redirect: redirect,
  };
};

module.exports = {
  getUserAddresses,
  addAddressService,
  getEditAddress,
  updateAddressService,
};
