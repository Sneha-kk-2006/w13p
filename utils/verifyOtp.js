const User = require("../../models/userSchema");




const verifyEmailOtp = async (req,res)=>{
    
 const otp = req.body.otp

 if(otp == req.session.emailOtp){

   const userId = req.session.user

   await User.findByIdAndUpdate(userId,{
      email:req.session.newEmail,
      name:req.session.profileData.name,
      phone:req.session.profileData.phone
   })

   res.redirect("/profile")

 }else{
   res.render("user/verify-otp",{message:"Invalid OTP"})
 }

}

module.exports = {
    verifyEmailOtp
}