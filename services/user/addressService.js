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
  } = data;

  console.log("Adding address for user:", userId, data);
  if (!userId) {
    return { success: false, redirect: "/login" };
  }

  if (!fullName || !phone || !addressline1 || !city || !state || !pincode) {
    return { success: false, message: "Required fields missing" };
  }

  await addressRepository.createAddress({
    userId,
    fullName,
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
    redirect: "/address",
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
  } = data;

  if (!fullName || !phone || !addressline1 || !city || !state || !pincode) {
    return { success: false, message: "Required fields missing" };
  }

  const updatedAddress = await addressRepository.updateByIdAndUser(id, userId, {
    fullName,
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
    redirect: "/address",
  };
};

module.exports = {
  getUserAddresses,
  addAddressService,
  getEditAddress,
  updateAddressService,
};
