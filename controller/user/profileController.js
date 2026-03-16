const express = require("express");
const router = express.Router();
const User = require("../../models/userSchema");

const fs = require("fs");
const path = require("path");

const loadprofile = async (req, res) => {
  try {
    const userId = req.session.user;

    if (!userId) {
      return res.redirect("/login");
    }

    const userData = await User.findById(userId);

    res.render("user/profile", { user: userData });
  } catch (error) {
    console.error("error occured", error);
    res.redirect("/errorPage");
  }
};

const updateProfile = async (req, res) => {
  try {
    console.log('req.file:', req.file);  // this will show uploaded file info
    console.log('req.body:', req.body);

    const userId = req.session.user; // or wherever you store user id

    let updateData = {
      name: req.body.name,
      phone: req.body.phone
    };

    if (req.file) {
      updateData.profileImage = '/uploads/' + req.file.filename; // save relative path
    }

    const user = await User.findByIdAndUpdate(userId, updateData, { returnDocument:"after" });
    res.redirect('/profile');
  } catch (err) {
    console.error(err);
    res.redirect('/profile');
  }
};

module.exports = { loadprofile, updateProfile };
