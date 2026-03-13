const express=require('express')
const router=express.Router()
const adminController=require('../controller/admin/adminController')
const {userAuth,adminAuth}=require("../middleware/auth")



router.get('/login',adminController.loadlogin)
router.post('/login',adminController.login)
router.get('/dashboard',adminAuth,adminController.loadDashboard)

router.get('/salesreport',adminController.loadsales)
router.get('/usermanagement',adminController.loaduser)
router.get("/error", adminController.loaderror)


router.get('/blockUser',adminController.blockUser)

router.get('/unblockUser',adminController.unblockUser)

module.exports=router