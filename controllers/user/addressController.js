const Address = require('../../models/addressSchema');
const User=require('../../models/userSchema')
const addressService=require('../../services/user/addressService')
const addressRepository = require("../../repositories/user");
// load address page
const loadAddress = async (req, res) => {
  try {
    const result = await addressService.getUserAddresses(req.session.user._id);

    if (!result.success) {
      return res.redirect(result.redirect);
    }
       const user = await User.findById(req.session.user._id);
    return res.render("user/address", {
      addresses: result.addresses,
      user:user
    });

  } catch (err) {
    console.log(err);
    return res.redirect("/errorPage");
  }
};

// add address
const addAddress = async (req, res) => {
  try {
    const redirect = req.body.redirect || req.query.redirect || "/address";
    const result = await addressService.addAddressService(
      { ...req.body, redirect },
      req.session.user._id
    );
    if (!result.success) {
      if (req.headers.accept && req.headers.accept.includes('application/json')) {
        return res.status(400).json({ success: false, message: result.message || "Operation failed" });
      }
      if (result.redirect) {
        return res.redirect(result.redirect);
      }
      return res.redirect("/address");
    }

    if (req.headers.accept && req.headers.accept.includes('application/json')) {
      return res.json({ success: true, message: "Operation successful" });
    }
    return res.redirect(result.redirect);

  } catch (error) {
    console.log("error", error);
    return res.redirect("/address");
  }
};




const deleteAddress = async (req, res) => {
  try {
    const addressId = req.query.id;
    await Address.findByIdAndDelete(addressId);
    res.redirect('/address');
  } catch (error) {
    console.log(error);
    res.redirect('/address');
  }
};



const loadEditAddress = async (req, res) => {
  try {
    const addressId = req.query.id;
    const redirect = req.query.redirect || "/address";
    const userId = req.session.user._id;

    const result = await addressService.getEditAddress(
      addressId,
      userId
    );

    if (!result.success) {
      return res.redirect(result.redirect);
    }

    res.render("user/edit-address", {
      address: result.address,
      redirect: redirect
    });

  } catch (error) {
    console.log(error);
    res.redirect("/address");
  }
};



const editAddress = async (req, res) => {
  try {
    const userId = req.session.user._id;
    const redirect = req.body.redirect || "/address";

    const result = await addressService.updateAddressService(
      { ...req.body, redirect },
      userId
    );

    if (!result.success) {
      if (req.headers.accept && req.headers.accept.includes('application/json')) {
        return res.status(400).json({ success: false, message: result.message || "Update failed" });
      }
      if (result.redirect) {
        return res.redirect(result.redirect);
      }
      return res.redirect("/address");
    }

    if (req.headers.accept && req.headers.accept.includes('application/json')) {
      return res.json({ success: true, message: "Address updated successfully" });
    }
    res.redirect(result.redirect);

  } catch (error) {
    console.log(error);
    res.redirect("/address");
  }
};

const setDefaultAddress = async (req, res) => {
  try {
    const addressId = req.query.id;
    const userId = req.session.user._id;

    await Address.updateMany({ userId }, { $set: { isDefault: false } });
    await Address.findByIdAndUpdate(addressId, { $set: { isDefault: true } });

    res.redirect('/address');
  } catch (error) {
    console.log(error);
    res.redirect('/address');
  }
};

module.exports = {
  loadAddress,
  addAddress,
  deleteAddress,
  loadEditAddress,
  editAddress,
  setDefaultAddress
};
