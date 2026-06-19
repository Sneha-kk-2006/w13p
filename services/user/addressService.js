const addressRepository = require("../../repositories/user");
// const Address = require("../../models/addressSchema");



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

const statePincodePrefixes = {
  andhrapradesh:        ["50", "51", "52", "53"],
  arunachalpradesh:     ["79"],
  assam:                ["78"],
  bihar:                ["80", "81", "82", "83", "84", "85"],
  chhattisgarh:         ["49"],
  goa:                  ["40"],
  gujarat:              ["36", "37", "38", "39"],
  haryana:              ["12", "13"],
  himachalpradesh:      ["17"],
  jharkhand:            ["82", "83", "84", "85"],
  karnataka:            ["56", "57", "58", "59"],
  kerala:               ["67", "68", "69"],
  madhyapradesh:        ["45", "46", "47", "48", "49"],
  maharashtra:          ["40", "41", "42", "43", "44"],
  manipur:              ["79"],
  meghalaya:            ["79"],
  mizoram:              ["79"],
  nagaland:             ["79"],
  odisha:               ["75", "76", "77"],
  punjab:               ["14", "15", "16"],
  rajasthan:            ["30", "31", "32", "33", "34"],
  sikkim:               ["73"],
  tamilnadu:            ["60", "61", "62", "63", "64"],
  telangana:            ["50", "51", "52", "53"],
  tripura:              ["79"],
  uttarpradesh:         ["20", "21", "22", "23", "24", "25", "26", "27", "28"],
  uttarakhand:          ["24", "26"],
  westbengal:           ["70", "71", "72", "73", "74"],
  delhi:                ["11"],
  jammuandkashmir:      ["18", "19"],
  ladakh:               ["19"],
  chandigarh:           ["16"],
  puducherry:           ["60"],
  andamanandnicobar:    ["74"],
  dadraandnagarhaveli:  ["39"],
  daman:                ["39"],
  diu:                  ["36"],
  lakshadweep:          ["68"],
};

function normalizeState(name) {
  if (!name) return "";
  return name.toLowerCase().replace(/[^a-z]/g, '');
}

function isValidStatePincode(state, pincode) {
  const normalizedState = normalizeState(state);
  const prefixes = statePincodePrefixes[normalizedState];
  
  if (!prefixes) return true;
  return prefixes.some(prefix => pincode.startsWith(prefix));
}

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

  if (!fullName || !phone || !addressline1 || !city || !state || !pincode) {
    return { success: false, message: "Required fields missing " };
  }
  const trimmedName = fullName.trim();

  const nameRegex = /^[a-zA-Z\s]{3,50}$/;
  const phoneRegex = /^[6-9]\d{9}$/;
  const pincodeRegex = /^[1-9]\d{5}$/;

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
    return { success: false, message: "Invalid pincode. Must be exactly 6 digits and cannot start with 0." };
  }

  if (!isValidStatePincode(state, pincode)) {
    return { success: false, message: `Pincode does not match the selected state (${state})` };
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

  if (!fullName || !phone || !addressline1 || !city || !state || !pincode) {
    return { success: false, message: "Required fields missing" };
  }
  const trimmedName = fullName.trim();

  const nameRegex = /^[a-zA-Z\s]{3,50}$/;
  const phoneRegex = /^[6-9]\d{9}$/;
  const pincodeRegex = /^[1-9]\d{5}$/;

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
    return { success: false, message: "Invalid pincode. Must be exactly 6 digits and cannot start with 0." };
  }

  if (!isValidStatePincode(state, pincode)) {
    return { success: false, message: `Pincode does not match the selected state (${state})` };
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
