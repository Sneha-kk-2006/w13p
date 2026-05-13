const express = require('express');
const router = express.Router();
const { isAuth, userAuth, isUser } = require("../middlewares/auth");
const passport = require('passport');
const userController = require("../controllers/user/authController");
const profileController = require('../controllers/user/profileController');
const upload = require('../middlewares/multer');
const categoryController = require('../controllers/user/categoryController')
const addressController = require('../controllers/user/addressController');
// const googleController = require("../../controllers/user/authController");
const productController = require('../controllers/user/productController')
const cartController = require('../controllers/user/cartController')
const wishlistController = require('../controllers/user/wishlistController')
const orderController = require('../controllers/user/orderController');
const walletController = require('../controllers/user/walletController');





router.get('/', isUser, userController.loadHomepage);
router.get('/errorPage', userController.errorPage);
router.get('/signup', isAuth, userController.loadsignup);
router.post('/signup', isAuth, userController.signup);
router.get('/validate-referral', userController.validateReferral);
router.get("/verify-otp", isUser, userController.loadVerify);
router.post("/verify-otp", isUser, userController.verifyOtp);
router.post("/resend-otp", isUser, userController.resendOtp);
router.get('/login', isAuth, userController.loadlogin);
router.post('/login', isAuth, userController.login);
router.get(
  '/google',
  passport.authenticate('google', { scope: ['profile', 'email'] })
);

router.get(
  '/google/callback',
  passport.authenticate('google', { failureRedirect: '/signup' }),
  userController.googleCallback
);
router.get('/forgotPassword', isAuth, userController.loadforgot);
router.post('/forgotPassword', isAuth, userController.forgotPassword);
router.get('/resetPassword', isAuth, userController.loadreset);
router.post('/resetPassword', isAuth, userController.resetPassword);
// router.get('/products', userController.loadproducts);

router.get('/profile', userAuth, profileController.loadprofile);
router.post('/editProfile', userAuth, upload.single("profileImage"), profileController.updateProfile);

router.get("/address", userAuth, addressController.loadAddress);
router.post('/addAddress', userAuth, addressController.addAddress);
router.get('/deleteAddress', userAuth, addressController.deleteAddress);
router.get('/editAddress', userAuth, addressController.loadEditAddress);
router.post('/editAddress', userAuth, addressController.editAddress);
router.get('/setDefaultAddress', userAuth, addressController.setDefaultAddress);

router.get('/changePassword', userAuth, profileController.loadChangePassword);
router.post('/changePassword', userAuth, profileController.changePassword);


router.get('/products', productController.getProducts)

router.post('/logout', profileController.logout);






router.get('/cart', userAuth, cartController.getcart)
router.post('/cart/add', userAuth, cartController.addToCart)
router.post('/cart/updateQty', userAuth, cartController.updateCartQty)
router.post('/cart/remove', userAuth, cartController.remove)
router.post('/cart/clearCart', userAuth, cartController.clearCart)


router.get('/wishlist', userAuth, wishlistController.getWishlist)
router.post('/wishlist/add', userAuth, wishlistController.addToWishlist)
router.post('/wishlist/remove', userAuth, wishlistController.removeFromWishlist)


router.get('/checkout', userAuth, orderController.loadCheckout);
router.post('/checkout/apply-coupon', userAuth, orderController.applyCoupon);
router.post('/checkout/remove-coupon', userAuth, orderController.removeCoupon);
router.post('/checkout/place-order', userAuth, orderController.placeOrder);
router.post('/checkout/razorpayOrder',userAuth,orderController.createRazorpayOrder)
router.post('/checkout/verifyPayment',userAuth,orderController.verifyRazorpayPayment)
router.post('/checkout/payment-failure', userAuth, orderController.recordPaymentFailure);
router.get('/checkout/success/:id', userAuth, orderController.loadOrderSuccess);
router.get('/checkout/payment-error/:id', userAuth, orderController.loadPaymentError);
router.get('/order-details/:id', userAuth, orderController.loadOrderDetails);
router.get('/orders', userAuth, orderController.loadOrders);
router.post('/order/cancel/:orderId/:itemId', userAuth, orderController.cancelOrderItem);
router.post('/order/return/:orderId/:itemId', userAuth, orderController.returnOrderItem);
router.get('/order/invoice/:orderId', userAuth, orderController.downloadInvoice);
router.delete('/orders/clear', userAuth, orderController.clearAllOrders);

router.get('/wallet', userAuth, walletController.loadWallet);
router.post('/wallet/add-money', userAuth, walletController.addMoney);
router.post('/wallet/createOrder',walletController.createRazorpayOrder);





router.get('/category', categoryController.loadcat)
router.get('/product/:id', productController.loadProductDetails)









module.exports = router;
