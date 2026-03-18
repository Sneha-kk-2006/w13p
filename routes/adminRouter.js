const express = require('express');
const router = express.Router();
const adminController = require('../controllers/admin/adminController');
const { userAuth, adminAuth } = require("../middlewares/auth");

router.get('/login', adminController.loadlogin);
router.post('/login', adminController.login);
router.get('/dashboard', adminAuth, adminController.loadDashboard);

router.get('/salesreport', adminAuth, adminController.loadsales);
router.get('/usermanagement', adminAuth, adminController.loaduser);
router.get("/error", adminAuth, adminController.loaderror);

router.get('/blockUser', adminAuth, adminController.blockUser);
router.get('/unblockUser', adminAuth, adminController.unblockUser);

module.exports = router;