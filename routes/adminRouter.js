const express = require('express');
const router = express.Router();
const adminController = require('../controllers/admin/adminController');
const categoryController=require('../controllers/admin/categoryController')
const productController=require('../controllers/admin/productController')
const { userAuth, adminAuth } = require("../middlewares/auth");
const uploads=require('../config/multer')




router.get('/login', adminController.loadlogin);
router.post('/login', adminController.login);
router.get('/dashboard', adminAuth, adminController.loadDashboard);

router.get('/salesreport', adminAuth, adminController.loadsales);
router.get('/usermanagement', adminAuth, adminController.loaduser);
router.get("/error", adminAuth, adminController.loaderror);

router.get('/blockUser', adminAuth, adminController.blockUser);
router.get('/unblockUser', adminAuth, adminController.unblockUser);


router.get('/category',categoryController.loadp)
router.post('/addCategory',categoryController.addCategory)
router.post('/category/edit/:id',categoryController.editCategory)
router.patch('/category/delete/:id',categoryController.deleteCategory)





router.get('/product',productController.loadProduct)
// router.post('/addProduct',productController.addProduct)
router.post(
  "/addProduct",
  uploads.array("images", 10),
  productController.addProduct
);




router.post('/product/edit/:id', uploads.array('images', 10), productController.editProduct);
router.patch('/product/delete/:id', productController.deleteProduct);
// router.post('/addProduct', productController.addProduct)
router.patch('/product/toggle/:id',productController.toggleProductStatus)
router.post('/product/addVariant/:id', uploads.array('images', 10), productController.addVariant);
router.post('/product/editVariant/:productId/:variantId', uploads.array('images', 10), productController.editVariant);
router.delete('/product/deleteVariant/:productId/:variantId', productController.deleteVariant);


module.exports = router;