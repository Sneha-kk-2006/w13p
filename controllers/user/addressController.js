const Address = require('../../models/addressSchema');
const User=require('../../models/userSchema')
const addressService=require('../../services/user/addressService')
const addressRepository = require("../../repositories/user");
// load address page
const loadAddress = async (req, res) => {
  try {
    const result = await addressService.getUserAddresses(req.session.user);

    if (!result.success) {
      return res.redirect(result.redirect);
    }
       const user = await User.findById(req.session.user);
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
    const result = await addressService.addAddressService(
      req.body,
      req.session.user
    );
    if (!result.success) {
      if (result.redirect) {
        return res.redirect(result.redirect);
      }

      return res.redirect("/address");
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
    const userId = req.session.user;

    const result = await addressService.getEditAddress(
      addressId,
      userId
    );

    if (!result.success) {
      return res.redirect(result.redirect);
    }

    res.render("user/edit-address", {
      address: result.address
    });

  } catch (error) {
    console.log(error);
    res.redirect("/address");
  }
};



const editAddress = async (req, res) => {
  try {
    const userId = req.session.user;

    const result = await addressService.updateAddressService(
      req.body,
      userId
    );

    if (!result.success) {
      if (result.redirect) {
        return res.redirect(result.redirect);
      }
      return res.redirect("/address");
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
    const userId = req.session.user;

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
