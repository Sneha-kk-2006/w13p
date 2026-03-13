const express=require('express')
const router=express.Router();
const user = require("../../models/userSchema");

const loadprofile = async (req, res) => {
  try {

    const userId = req.session.user;

    if (!userId) {
      return res.redirect("/login");
    }

    const userData = await user.findById(userId);

    res.render("user/profile", { user: userData });

  } catch (error) {
    console.error("error occured", error);
    res.redirect("/errorPage");
  }
};



const loadaddress=async(req,res)=>{
        res.render('user/address')
}
module.exports = { loadprofile ,loadaddress}