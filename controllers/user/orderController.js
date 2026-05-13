const mongoose = require("mongoose");
const Cart = require("../../models/cartSchema");
const Address = require("../../models/addressSchema");
const Product = require("../../models/productSchema");
const Order = require("../../models/orderSchema");
const walletService = require("../../services/walletService");
const Razorpay = require("razorpay");
const crypto = require("crypto");

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

const Coupon = require("../../models/couponSchema");
const { getBestOffer } = require('./productController');


const loadCheckout = async (req, res) => {
  try {
    const userId = typeof req.session.user === 'object' ? req.session.user._id : req.session.user;


    let cart = await Cart.findOne({ userId }).populate({
      path: "items.productId",
      populate: { path: "category" },
    });

    if (!cart || cart.items.length === 0) {
      return res.redirect("/cart");
    }

    cart.items = cart.items.filter(
      (item) =>
        item.productId &&
        item.productId.isActive !== false &&
        item.productId.isDeleted !== true &&
        (!item.productId.category ||
          (item.productId.category.isActive !== false &&
            item.productId.category.isDeleted !== true))
    );

    let subtotal = 0;
    let discount = 0;

    const mappedItems = await Promise.all(cart.items.map(async (item) => {
      const product = item.productId;
      let targetPrice = product.price || 0;
      let targetColor = product.color || "N/A";
      let targetSize = product.size || "N/A";
      let targetImage = product.images?.[0] || "";

      if (item.variantId && product.variants && product.variants.length > 0) {
        const variant = product.variants.find(
          (v) => v._id.toString() === item.variantId.toString()
        );
        if (variant) {
          targetPrice = variant.price || targetPrice;
          targetColor = variant.color || targetColor;
          targetSize = variant.size || targetSize;
          if (variant.images && variant.images.length > 0) {
            targetImage = variant.images[0];
          }
        }
      }

      const itmOffer = await getBestOffer(product._id, product.category?._id);
      const discountPct = itmOffer ? itmOffer.discount : (product.discount || 0);
      const salePrice = Math.round(targetPrice * (1 - discountPct / 100));

      const itemSubtotal = targetPrice * item.quantity;
      const itemDiscount = targetPrice * (discountPct / 100) * item.quantity;

      subtotal += itemSubtotal;
      discount += itemDiscount;

      return {
        _id: item._id,
        productId: product._id,
        productName: product.name,
        productImage: targetImage,
        color: targetColor,
        size: targetSize,
        unitPrice: salePrice,
        oldPrice: targetPrice,
        quantity: item.quantity,
        totalPrice: item.quantity * salePrice,
      };
    }));

    const subtotalAfterDiscount = subtotal - discount;
    const gst = Math.round(subtotalAfterDiscount * 0.18);
    let total = subtotalAfterDiscount + gst;

    // Apply Coupon logic from session
    let appliedCoupon = null;
    let couponDiscount = 0;
    if (req.session.appliedCoupon) {
      const coupon = await Coupon.findOne({ code: req.session.appliedCoupon, isActive: true, expiryDate: { $gt: new Date() } });
      if (coupon && subtotalAfterDiscount >= coupon.minOrderAmount) {
        if (coupon.discountType === 'percentage') {
          couponDiscount = Math.round(subtotalAfterDiscount * (coupon.discountValue / 100));
          if (coupon.maxDiscountValue > 0 && couponDiscount > coupon.maxDiscountValue) {
            couponDiscount = coupon.maxDiscountValue;
          }
        } else {
          couponDiscount = coupon.discountValue;
        }
        total -= couponDiscount;
        appliedCoupon = coupon;
      } else {
        delete req.session.appliedCoupon;
      }
    }

    const addresses = await Address.find({ userId });
    const walletBalance = await walletService.getBalance(userId);
    const availableCoupons = await Coupon.find({
      isActive: true,
      expiryDate: { $gt: new Date() },
      minOrderAmount: { $lte: subtotalAfterDiscount },
      $expr: { $lt: ["$usedCount", "$maxUsage"] }
    });


    res.render("user/checkout", {
      items: mappedItems,
      subtotal,
      discount,
      gst,
      total,
      addresses,
      walletBalance,
      availableCoupons,
      appliedCoupon,
      couponDiscount
    });
  } catch (error) {
    console.error("loadCheckout error:", error);
    res.status(500).send("Server Error");
  }
};

const placeOrder = async (req, res) => {
  try {
    const userId = typeof req.session.user === 'object' ? req.session.user._id : req.session.user;
    const { addressId, paymentMethod, paymentStatus: forcedPaymentStatus } = req.body;

    console.log("Place Order Request:", { userId, addressId, paymentMethod });

    if (!addressId || !paymentMethod) {
      return res.status(400).json({ success: false, message: "Missing address or payment method" });
    }
    const cart = await Cart.findOne({ userId }).populate("items.productId");
    if (!cart || cart.items.length === 0) {
      return res.status(400).json({ success: false, message: "Cart is empty" });
    }

    const address = await Address.findById(addressId);
    if (!address) {
      return res.status(400).json({ success: false, message: "Invalid address" });
    }

    // Address validation
    if (
      !address.fullName ||
      !address.addressline1 ||
      !address.city ||
      !address.state ||
      !address.pincode ||
      !address.phone
    ) {
      return res.status(400).json({ success: false, message: "Incomplete address" });
    }

    const phoneRegex = /^[6-9]\d{9}$/;
    const pincodeRegex = /^\d{6}$/;

    if (!phoneRegex.test(address.phone)) {
      return res.status(400).json({ success: false, message: "Invalid phone number in selected address" });
    }

    if (!pincodeRegex.test(address.pincode)) {
      return res.status(400).json({ success: false, message: "Invalid pincode in selected address" });
    }

    let totalPrice = 0;
    const orderItems = [];
    const productsToUpdate = [];

    // 1. Initial validation and price calculation loop (No Saves yet)
    for (const item of cart.items) {
      const product = item.productId;
      if (!product) continue;

      let unitPrice = product.price || 0;
      let targetStockContainer = product; // Default to main product
      let variantToUpdate = null;

      if (item.variantId && product.variants && product.variants.length > 0) {
        variantToUpdate = product.variants.find(v => v._id.toString() === item.variantId.toString());
        if (variantToUpdate) {
          unitPrice = variantToUpdate.price || unitPrice;
          if (variantToUpdate.stock < item.quantity) {
            return res.status(400).json({ success: false, message: `Insufficient stock for ${product.name} (${variantToUpdate.size}/${variantToUpdate.color})` });
          }
          targetStockContainer = variantToUpdate;
        }
      } else {
        if (product.stock < item.quantity) {
          return res.status(400).json({ success: false, message: `Insufficient stock for ${product.name}` });
        }
      }

      const itmOffer = await getBestOffer(product._id, product.category?._id);
      const discountPct = itmOffer ? itmOffer.discount : (product.discount || 0);
      const salePrice = Math.round(unitPrice * (1 - discountPct / 100));
      totalPrice += salePrice * item.quantity;

      orderItems.push({
        product: product._id,
        variantId: item.variantId,
        quantity: item.quantity,
        price: salePrice,
        status: "Pending"
      });

      productsToUpdate.push({
        productDoc: product,
        variantDoc: variantToUpdate,
        quantity: item.quantity
      });
    }

    const gst = Math.round(totalPrice * 0.18);
    let finalTotalPrice = totalPrice + gst;

    // Apply Coupon Discount
    let couponDiscountAmount = 0;
    if (req.session.appliedCoupon) {
      const coupon = await Coupon.findOne({ code: req.session.appliedCoupon, isActive: true });
      if (coupon && totalPrice >= coupon.minOrderAmount) {
        if (coupon.discountType === 'percentage') {
          couponDiscountAmount = Math.round(totalPrice * (coupon.discountValue / 100));
          if (coupon.maxDiscountValue > 0 && couponDiscountAmount > coupon.maxDiscountValue) {
            couponDiscountAmount = coupon.maxDiscountValue;
          }
        } else {
          couponDiscountAmount = coupon.discountValue;
        }
        finalTotalPrice -= couponDiscountAmount;

        // Increment coupon usage
        coupon.usedCount += 1;
        await coupon.save();
      }
    }

    const orderId = "ORD" + Math.floor(100000 + Math.random() * 900000);
    if (paymentMethod === "Wallet") {
      const walletBalance = await walletService.getBalance(userId);
      if (walletBalance < finalTotalPrice) {
        return res.status(400).json({ success: false, message: "Insufficient wallet balance" });
      }
      // Deduct from wallet
      await walletService.debit(userId, finalTotalPrice, `Order payment for ${orderId}`, { orderRef: orderId });
    }



    // 2. Atomic Stock Reduction (Skip for failed payments since items stay in cart)
    if (forcedPaymentStatus !== "Failed") {
      for (const update of productsToUpdate) {
        if (update.variantDoc) {
          update.variantDoc.stock -= update.quantity;
        } else {
          update.productDoc.stock -= update.quantity;
        }
        await update.productDoc.save();
      }
    }


    const newOrder = new Order({
      orderId,
      userId,
      orderItems,
      totalPrice: finalTotalPrice,
      discount: couponDiscountAmount, // Store coupon discount if any
      shippingAddress: {
        fullName: address.fullName,
        addressline1: address.addressline1,
        city: address.city,
        state: address.state,
        pincode: address.pincode,
        country: address.country,
        phone: address.phone
      },
      paymentMethod,
      paymentStatus: forcedPaymentStatus || ((paymentMethod === "COD") ? "Pending" : "Paid"),
      orderStatus: (forcedPaymentStatus === "Failed") ? "Pending" : "Pending", // orderStatus remains Pending either way for now
      gst: gst



    });

    console.log("Saving new order:", orderId);
    await newOrder.save();

    // Clear Cart and Applied Coupon only on success
    if (newOrder.paymentStatus !== "Failed") {
      await Cart.findOneAndDelete({ userId });
      delete req.session.appliedCoupon;
    }

    console.log("Order placed successfully:", orderId);
    res.json({ success: true, orderId: newOrder._id, paymentStatus: newOrder.paymentStatus });

  } catch (error) {
    console.error("placeOrder error:", error);
    res.status(500).json({ success: false, message: "Internal server error: " + error.message });
  }
};

const loadOrderSuccess = async (req, res) => {
  try {
    const orderId = req.params.id;
    const order = await Order.findById(orderId).populate("orderItems.product");

    if (!order) {
      return res.redirect("/");
    }

    res.render("user/orderSuccess", {
      order
    });
  } catch (error) {
    console.error("loadOrderSuccess error:", error);
    res.status(500).send("Server Error");
  }
};

const loadPaymentError = async (req, res) => {
  try {
    const orderId = req.params.id;
    const order = await Order.findById(orderId).populate("orderItems.product");

    if (!order) {
      return res.redirect("/");
    }

    res.render("user/payment-error", {
      order
    });
  } catch (error) {
    console.error("loadPaymentError error:", error);
    res.status(500).send("Server Error");
  }
};

const loadOrderDetails = async (req, res) => {
  try {
    const orderId = req.params.id;
    const order = await Order.findById(orderId).populate("orderItems.product");

    if (!order) {
      return res.redirect("/orders");
    }

    res.render("user/orderDetails", {
      order
    });
  } catch (error) {
    console.error("loadOrderDetails error:", error);
    res.status(500).send("Server Error");
  }
};

const loadOrders = async (req, res) => {
  try {
    const userId = typeof req.session.user === 'object' ? req.session.user._id : req.session.user;
    const search = req.query.search || "";

    let query = { userId };
    if (search) {
      query.orderId = { $regex: search, $options: "i" };
    }

    const orders = await Order.find(query).sort({ createdAt: -1 });

    res.render("user/orders", {
      orders,
      search
    });
  } catch (error) {
    console.error("loadOrders error:", error);
    res.status(500).send("Server Error");
  }
};

const cancelOrderItem = async (req, res) => {
  try {
    const { orderId, itemId } = req.params;
    const { reason } = req.body;
    const userId = typeof req.session.user === 'object' ? req.session.user._id : req.session.user;

    const order = await Order.findOne({ _id: orderId, userId });
    if (!order) return res.status(404).json({ success: false, message: "Order not found" });

    const item = order.orderItems.id(itemId);
    if (!item) return res.status(404).json({ success: false, message: "Item not found" });

    const currentStatus = item.status || order.orderStatus;
    if (currentStatus !== "Pending") {
      return res.status(400).json({ success: false, message: "Only pending items can be cancelled." });
    }

    item.status = "Cancelled";
    item.cancellationReason = reason || "No reason provided";

    // Restore stock
    const product = await Product.findById(item.product);
    if (product) {
      if (item.variantId && product.variants && product.variants.length > 0) {
        const variant = product.variants.find(v => v._id.toString() === item.variantId.toString());
        if (variant) variant.stock += item.quantity;
      } else {
        product.stock += item.quantity;
      }
      await product.save();
    }

    // Reduce the total price of the order
    const itemTotalPrice = item.price * item.quantity;
    order.totalPrice = Math.max(0, order.totalPrice - itemTotalPrice);

    // Check if all items are cancelled
    const allCancelled = order.orderItems.every(i => i.status === "Cancelled");
    if (allCancelled) order.orderStatus = "Cancelled";

    // Refund Logic
    if (order.paymentStatus === "Paid" || order.paymentMethod === "Wallet") {
      await walletService.refundForCancellation(
        userId,
        itemTotalPrice,
        order._id,
        order.orderId
      );
    }

    await order.save();

    return res.json({ success: true, message: "Item cancelled successfully." });
  } catch (error) {
    console.error("cancelOrderItem error:", error);
    res.status(500).json({ success: false, message: "Server Error" });
  }
};


const clearAllOrders = async (req, res) => {
  try {
    const userId = typeof req.session.user === 'object' ? req.session.user._id : req.session.user;
    await Order.deleteMany({ userId });
    return res.json({ success: true, message: "Order history cleared successfully." });
  } catch (error) {
    console.error("clearAllOrders error:", error);
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

const returnOrderItem = async (req, res) => {
  try {
    const { orderId, itemId } = req.params;
    const { reason } = req.body;
    const userId = typeof req.session.user === 'object' ? req.session.user._id : req.session.user;

    const order = await Order.findOne({ _id: orderId, userId });
    if (!order) return res.status(404).json({ success: false, message: "Order not found" });

    const item = order.orderItems.id(itemId);
    if (!item) return res.status(404).json({ success: false, message: "Item not found" });

    const currentStatus = item.status || order.orderStatus;
    if (currentStatus !== "Delivered") {
      return res.status(400).json({ success: false, message: "Only delivered items can be returned." });
    }


    item.status = "Return Requested";
    item.returnReason = reason || "No reason provided";

    // Check if all items are return requested
    const allReturnRequested = order.orderItems.every(i => i.status === "Return Requested" || i.status === "Cancelled");
    if (allReturnRequested) order.orderStatus = "Return Requested";

    await order.save();
    return res.json({ success: true, message: "Return request submitted for item." });
  } catch (error) {
    console.error("returnOrderItem error:", error);
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

const PDFDocument = require('pdfkit-table');

const downloadInvoice = async (req, res) => {
  try {
    const orderId = req.params.orderId;
    const order = await Order.findById(orderId).populate("orderItems.product");

    if (!order) {
      return res.status(404).send("Order not found");
    }

    const doc = new PDFDocument({ margin: 30, size: 'A4' });

    // Set response headers
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=invoice-${order.orderId}.pdf`);

    doc.pipe(res);

    // Header
    doc.fontSize(25).text('SNOVA', { align: 'right' });
    doc.fontSize(10).text('123 Fashion Street', { align: 'right' });
    doc.text('Calicut, Kerala, 673001', { align: 'right' });
    doc.text('GSTIN: 32AAAAA0000A1Z5', { align: 'right' });
    doc.moveDown();

    doc.fontSize(20).text('INVOICE', { underline: true });
    doc.moveDown();

    // Order Info
    doc.fontSize(10).text(`Order ID: ${order.orderId}`);
    doc.text(`Date: ${new Date(order.createdAt).toLocaleDateString('en-GB')}`);
    doc.text(`Payment Method: ${order.paymentMethod}`);
    doc.moveDown();

    // Billing Details
    doc.fontSize(12).text('Bill To:', { underline: true });
    doc.fontSize(10).text(order.shippingAddress.fullName);
    doc.text(order.shippingAddress.addressline1);
    doc.text(`${order.shippingAddress.city}, ${order.shippingAddress.state}`);
    doc.text(`${order.shippingAddress.country} - ${order.shippingAddress.pincode}`);
    doc.text(`Phone: ${order.shippingAddress.phone}`);
    doc.moveDown();

    // Items Table
    let invoiceTotal = 0;
    const table = {
      title: "Order Items",
      headers: ["Product", "Status", "Quantity", "Price", "Total"],
      rows: order.orderItems.map(item => {
        const itemStatus = item.status || "Pending";
        const isCancelled = itemStatus === "Cancelled";
        const itemTotal = isCancelled ? 0 : (item.quantity * item.price);

        if (!isCancelled) {
          invoiceTotal += itemTotal;
        }

        return [
          item.product ? item.product.name : "Product Removed",
          itemStatus,
          item.quantity.toString(),
          `INR ${item.price.toLocaleString()}`,
          isCancelled ? "CANCELLED" : `INR ${itemTotal.toLocaleString()}`
        ];
      }),
    };

    await doc.table(table, {
      prepareHeader: () => doc.font("Helvetica-Bold").fontSize(10),
      prepareRow: (row, indexColumn, indexRow, rectRow, rectCell) => {
        doc.font("Helvetica").fontSize(10);
      },
    });

    doc.moveDown();
    doc.fontSize(10).text(`Subtotal: INR ${invoiceTotal.toLocaleString()}`, { align: 'right' });
    doc.text(`Discount: INR ${(order.discount || 0).toLocaleString()}`, { align: 'right' });
    doc.text(`GST (18%): INR ${(order.gst || 0).toLocaleString()}`, { align: 'right' });
    doc.moveDown(0.5);
    doc.fontSize(14).text(`Grand Total: INR ${order.totalPrice.toLocaleString()}`, { align: 'right' });

    doc.moveDown();
    doc.fontSize(10).text('Thank you for shopping with SNOVA!', { align: 'center', italic: true });


    doc.end();

  } catch (error) {
    console.error("downloadInvoice error:", error);
    if (!res.headersSent) {
      res.status(500).send("Error generating invoice");
    }
  }
};

const createRazorpayOrder = async (req, res) => {
  try {
    const userId = typeof req.session.user === 'object' ? req.session.user._id : req.session.user;
    const { addressId } = req.body;
    const cart = await Cart.findOne({ userId }).populate("items.productId");
    if (!cart || cart.items.length === 0) {
      return res.status(400).json({ success: false, message: "Cart is empty" })
    }
    let totalPrice = 0;
    for (const item of cart.items) {
      const product = item.productId;
      if (!product) continue;
      let unitPrice = product.price || 0;
      if (item.variantId && product.variants?.length > 0) {
        const variant = product.variants.find(v => v._id.toString() === item.variantId.toString());
        if (variant) unitPrice = variant.price || unitPrice;
      }
      const discountPct = product.discount || 0;
      const salePrice = Math.round(unitPrice * (1 - discountPct / 100));
      totalPrice += salePrice * item.quantity;
    }
    const gst = Math.round(totalPrice * 0.18);
    let finalTotal = totalPrice + gst;

    // Apply Coupon Discount for Razorpay order creation
    if (req.session.appliedCoupon) {
      const coupon = await Coupon.findOne({ code: req.session.appliedCoupon, isActive: true });
      if (coupon && totalPrice >= coupon.minOrderAmount) {
        let couponDiscountAmount = 0;
        if (coupon.discountType === 'percentage') {
          couponDiscountAmount = Math.round(totalPrice * (coupon.discountValue / 100));
          if (coupon.maxDiscountValue > 0 && couponDiscountAmount > coupon.maxDiscountValue) {
            couponDiscountAmount = coupon.maxDiscountValue;
          }
        } else {
          couponDiscountAmount = coupon.discountValue;
        }
        finalTotal -= couponDiscountAmount;
      }
    }

    // Create Razorpay order
    const razorpayOrder = await razorpay.orders.create({
      amount: Math.round(finalTotal * 100), // convert to paise and ensure it's an integer
      currency: "INR",
      receipt: `receipt_${Date.now()}`,
    });

    res.json({
      success: true,
      orderId: razorpayOrder.id,
      amount: razorpayOrder.amount,
      currency: razorpayOrder.currency,
      keyId: process.env.RAZORPAY_KEY_ID,
    });
  } catch (error) {
    console.error("Razorpay order creation error:", error);
    res.status(500).json({ success: false, message: "Could not initiate Razorpay payment. " + error.message });
  }
};

const verifyRazorpayPayment = async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, addressId } = req.body;

    const body = razorpay_order_id + "|" + razorpay_payment_id;
    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(body)
      .digest("hex");

    if (expectedSignature !== razorpay_signature) {
      // Payment verification failed — we still want to create the order but mark it as failed
      req.body.paymentMethod = "Razorpay";
      req.body.paymentStatus = "Failed";
      return placeOrder(req, res);
    }

    // Signature valid — place the order as Paid
    req.body.paymentMethod = "Razorpay";
    req.body.paymentStatus = "Paid";
    return placeOrder(req, res);

  } catch (error) {
    console.error("verifyRazorpayPayment error:", error);
    res.status(500).json({ success: false, message: "Verification error: " + error.message });
  }
}

const recordPaymentFailure = async (req, res) => {
  try {
    req.body.paymentMethod = "Razorpay";
    req.body.paymentStatus = "Failed";
    return placeOrder(req, res);
  } catch (error) {
    console.error("recordPaymentFailure error:", error);
    res.status(500).json({ success: false, message: "Error recording failure" });
  }
};

const applyCoupon = async (req, res) => {
  try {
    const { code } = req.body;
    const userId = typeof req.session.user === 'object' ? req.session.user._id : req.session.user;

    const coupon = await Coupon.findOne({ code: code.toUpperCase(), isActive: true });

    if (!coupon) {
      return res.json({ success: false, message: "Invalid coupon code" });
    }

    if (new Date() > coupon.expiryDate) {
      return res.json({ success: false, message: "Coupon has expired" });
    }

    if (coupon.usedCount >= coupon.maxUsage) {
      return res.json({ success: false, message: "Coupon usage limit reached" });
    }

    // Calculate current subtotal to check minOrderAmount
    let cart = await Cart.findOne({ userId }).populate("items.productId");
    let subtotal = 0;
    let discount = 0;

    const mappedItems = await Promise.all(cart.items.map(async (item) => {
      const product = item.productId;
      if (!product) return;

      let targetPrice = product.price || 0;
      if (item.variantId && product.variants) {
        const variant = product.variants.find(v => v._id.toString() === item.variantId.toString());
        if (variant) targetPrice = variant.price || targetPrice;
      }

      const itmOffer = await getBestOffer(product._id, product.category?._id);
      const discountPct = itmOffer ? itmOffer.discount : (product.discount || 0);
      
      subtotal += targetPrice * item.quantity;
      discount += targetPrice * (discountPct / 100) * item.quantity;
    }));

    const subtotalAfterDiscount = subtotal - discount;

    if (subtotalAfterDiscount < coupon.minOrderAmount) {
      return res.json({ success: false, message: `Minimum purchase of ₹${coupon.minOrderAmount} required` });
    }

    req.session.appliedCoupon = coupon.code;
    res.json({ success: true, message: "Coupon applied successfully" });

  } catch (error) {
    console.error("applyCoupon error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

const removeCoupon = async (req, res) => {
  try {
    delete req.session.appliedCoupon;
    res.json({ success: true, message: "Coupon removed" });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error" });
  }
};






module.exports = {
  loadCheckout,
  applyCoupon,
  removeCoupon,
  placeOrder,
  loadOrderSuccess,
  loadPaymentError,
  loadOrderDetails,
  loadOrders,
  cancelOrderItem,
  clearAllOrders,
  returnOrderItem,
  downloadInvoice,
  createRazorpayOrder,
  verifyRazorpayPayment,
  recordPaymentFailure
};
