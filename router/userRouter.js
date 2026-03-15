const express=require('express')
const router=express.Router()
const{isAuth,userAuth, isUser}=require("../middleware/auth")
const passport=require('passport')
const userController=require("../controller/user/auth.controller")
const profileController=require('../controller/user/profileController')


router.get('/',isUser,userController.loadHomepage)
router.get('/errorPage',userController.errorPage)
router.get('/signup',isAuth,userController.loadsignup)
router.post('/signup',isAuth,userController.signup)
router.get( "/verify-otp",isAuth,userController.loadVerify)
router.post('/verify-otp',isAuth,userController.verifyOtp)
router.post('/resend-otp',isAuth,userController.resendOtp)
router.get('/login',isAuth,userController.loadlogin)
router.post('/login',isAuth,userController.login)
router.get('/google',passport.authenticate('google',{scope:['profile','email']}))
router.get('/google/callback', passport.authenticate('google',{failureRedirect:'/signup'}),(req,res)=>{
    res.redirect('/')
});
router.get('/forgotPassword',isAuth,userController.loadforgot)
router.post('/forgotPassword',isAuth, userController.forgotPassword)
router.get('/resetPassword',isAuth,userController.loadreset)
router.post('/resetPassword', isAuth,userController.resetPassword)
router.get('/products',userController.loadproducts)



router.get('/profile',profileController.loadprofile)


module.exports=router;