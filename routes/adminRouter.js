const express = require('express');
const router = express.Router();
const adminController = require('../controllers/admin/adminController');
const categoryController = require('../controllers/admin/categoryController')
const productController = require('../controllers/admin/productController')
const orderController = require('../controllers/admin/orderController');
const couponController = require('../controllers/admin/couponController');
const { userAuth, adminAuth } = require("../middlewares/auth");
const uploads = require('../config/multer')
const offerController = require('../controllers/admin/offerController');

const {
  getDashboard,
  getSalesReport,
  getChartData,
  downloadExcel,
  downloadPDF,
  getLedger
} = require('../controllers/admin/reportController');



router.get('/login', adminController.loadlogin);
router.post('/login', adminController.login);
router.get('/logout', adminController.logout);
router.get('/dashboard', adminAuth, getDashboard);

router.get('/salesreport', adminAuth, getSalesReport);
router.get('/salesreport/excel', adminAuth, downloadExcel);
router.get('/salesreport/pdf', adminAuth, downloadPDF);

router.get('/usermanagement', adminAuth, adminController.loaduser);
router.get("/error", adminAuth, adminController.loaderror);

router.get('/blockUser', adminAuth, adminController.blockUser);
router.get('/unblockUser', adminAuth, adminController.unblockUser);


router.get('/category', categoryController.loadp)
router.post('/addCategory', categoryController.addCategory)
router.post('/category/edit/:id', categoryController.editCategory)
router.patch('/category/delete/:id', categoryController.deleteCategory)
router.patch('/category/toggle/:id', categoryController.toggleCategoryStatus)





router.get('/product', productController.loadProduct)

router.post(
  "/addProduct",
  uploads.array("images", 10),
  productController.addProduct
);




router.post('/product/edit/:id', uploads.array('images', 10), productController.editProduct);
router.patch('/product/delete/:id', productController.deleteProduct);
// router.post('/addProduct', productController.addProduct)
router.patch('/product/toggle/:id', productController.toggleProductStatus)
router.post('/product/addVariant/:id', uploads.array('images', 10), productController.addVariant);
router.post('/product/editVariant/:productId/:variantId', uploads.array('images', 10), productController.editVariant);
router.delete('/product/deleteVariant/:productId/:variantId', productController.deleteVariant);
router.patch('/product/setPrimary/:id', productController.setPrimaryImage);
router.delete('/product/removeImage/:productId', adminAuth, productController.removeProductImage);
router.get('/product/variants/:id', adminAuth, productController.viewVariants);
router.get('/inventory', adminAuth, productController.loadInventory);

// Order Management
router.get('/orders', adminAuth, orderController.loadOrders);
router.post('/orders/updateStatus', adminAuth, orderController.updateOrderStatus);
router.post('/orders/updateItemStatus', adminAuth, orderController.updateItemStatus);
router.get('/orders/detail/:id', adminAuth, orderController.viewOrderDetail);

// Coupon Management
router.get('/coupons', couponController.loadCoupons);
router.post('/coupons/add', adminAuth, couponController.addCoupon);
router.delete('/coupons/delete/:id', adminAuth, couponController.deleteCoupon);
router.patch('/coupons/toggle/:id', adminAuth, couponController.toggleCouponStatus);





router.get('/offers', adminAuth, offerController.loadoffers);
router.post('/offers/add', adminAuth, offerController.addOffer);
router.patch('/offers/toggle/:id', adminAuth, offerController.toggleOfferStatus);
router.delete('/offers/delete/:id', adminAuth, offerController.deleteOffer);
router.put('/offers/edit/:id',adminAuth,offerController.editOffer);



router.get('/dashboard/chart', adminAuth, getChartData);   // AJAX
router.get('/ledger', adminAuth, getLedger);


module.exports = router;