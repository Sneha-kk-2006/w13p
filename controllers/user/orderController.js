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
      const coupon = await Coupon.findOne({
        code: req.session.appliedCoupon,
        isActive: true,
        expiryDate: { $gt: new Date() }
      });

      if (coupon && subtotalAfterDiscount >= coupon.minOrderAmount) {
        if (coupon.discountType === 'percentage') {
          couponDiscount = Math.round(subtotalAfterDiscount * (coupon.discountValue / 100));
          if (coupon.maxDiscountValue > 0 && couponDiscount > coupon.maxDiscountValue) {
            couponDiscount = coupon.maxDiscountValue;
          }
        } else {
          couponDiscount = coupon.discountValue;
        }
        if (couponDiscount >= subtotalAfterDiscount) {
          delete req.session.appliedCoupon;
          couponDiscount = 0;
        } else {
          total -= couponDiscount;
          appliedCoupon = coupon;
        }
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


    const {
      addressId,
      paymentMethod,
      paymentStatus: forcedPaymentStatus,
      razorpayPaymentId,
      razorpayOrderId,
      razorpaySignature
    } = req.body;

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
  
    const pincodeRegex = /^[1-9]\d{5}$/;

   
    const statePincodePrefixes = {
      andhrapradesh:        ["50", "51", "52", "53"],
      arunachalpradesh:     ["79"],
      assam:                ["78"],
      bihar:                ["80", "81", "82", "83", "84", "85"],
      chhattisgarh:         ["49"],
      goa:                  ["40"],
      gujarat:              ["36", "37", "38", "39"],
      haryana:              ["12", "13"],
      himachalpradesh:      ["17"],
      jharkhand:            ["82", "83", "84", "85"],
      karnataka:            ["56", "57", "58", "59"],
      kerala:               ["67", "68", "69"],
      madhyapradesh:        ["45", "46", "47", "48", "49"],
      maharashtra:          ["40", "41", "42", "43", "44"],
      manipur:              ["79"],
      meghalaya:            ["79"],
      mizoram:              ["79"],
      nagaland:             ["79"],
      odisha:               ["75", "76", "77"],
      punjab:               ["14", "15", "16"],
      rajasthan:            ["30", "31", "32", "33", "34"],
      sikkim:               ["73"],
      tamilnadu:            ["60", "61", "62", "63", "64"],
      telangana:            ["50", "51", "52", "53"],
      tripura:              ["79"],
      uttarpradesh:         ["20", "21", "22", "23", "24", "25", "26", "27", "28"],
      uttarakhand:          ["24", "26"],
      westbengal:           ["70", "71", "72", "73", "74"],
      delhi:                ["11"],
      jammuandkashmir:      ["18", "19"],
      ladakh:               ["19"],
      chandigarh:           ["16"],
      puducherry:           ["60"],
      andamanandnicobar:    ["74"],
      dadraandnagarhaveli:  ["39"],
      daman:                ["39"],
      diu:                  ["36"],
      lakshadweep:          ["68"],
    };

    function normalizeState(name) {
      if (!name) return "";
      return name.toLowerCase().replace(/[^a-z]/g, '');
    }

    function isValidStatePincode(state, pincode) {
      const normalizedState = normalizeState(state);
      const prefixes = statePincodePrefixes[normalizedState];
      
      if (!prefixes) return true;

      return prefixes.some(prefix => pincode.startsWith(prefix));
    }

    
    if (!pincodeRegex.test(address.pincode)) {
      return res.status(400).json({ 
        success: false, 
        message: "Invalid pincode — must be a 6-digit number not starting with 0" 
      });
    }

    
    if (!isValidStatePincode(address.state, address.pincode)) {
      return res.status(400).json({
        success: false,
        message: `Pincode does not match the selected state (${address.state})`
      });
    }

   
    if (!phoneRegex.test(address.phone)) {
      return res.status(400).json({ 
        success: false, 
        message: "Invalid phone number in selected address" 
      });
    }

    let totalPrice = 0;
    const orderItems = [];
    const productsToUpdate = [];


    for (const item of cart.items) {
      const product = await Product.findById(item.productId._id || item.productId)
        .populate('category');

      if (!product || product.isBlocked || product.isDeleted) {
        return res.status(400).json({
          success: false,
          message: `Product is no longer available`
        });
      }

      let unitPrice = product.salePrice || product.price;
      let variantToUpdate = null;

      if (item.variantId && product.variants?.length > 0) {
        variantToUpdate = product.variants.find(
          v => v._id.toString() === item.variantId.toString()
        );
        if (variantToUpdate) {
          unitPrice = variantToUpdate.salePrice || variantToUpdate.price || unitPrice;
          if (variantToUpdate.stock < item.quantity) {
            return res.status(400).json({
              success: false,
              message: `Insufficient stock for ${product.name}`
            });
          }
        }
      } else {
        if (product.stock < item.quantity) {
          return res.status(400).json({
            success: false,
            message: `Insufficient stock for ${product.name}`
          });
        }
      }
   

const isCategoryInvalid = !product.category || product.category.isDeleted === true;
const isProductInactive = product.isActive === false;

if (isCategoryInvalid || isProductInactive) {
  // Razorpay already paid ആണെങ്കിൽ — wallet refund ചെയ്യുക
  if (paymentMethod === 'Razorpay' && forcedPaymentStatus === 'Paid') {
    const refundAmount = req.session.pendingOrderAmount || 0;
    if (refundAmount > 0) {
      await walletService.credit(
        userId,
        refundAmount,
        `Refund: "${product.name}" category unavailable`,
        { orderRef: 'REFUND' }
      );
    }
    return res.status(400).json({
      success: false,
      message: `"${product.name}" is no longer available. ₹${refundAmount} refunded to your wallet.`
    });
  }

  return res.status(400).json({
    success: false,
    message: isCategoryInvalid
      ? `"${product.name}" is no longer available (category removed)`
      : `"${product.name}" is currently inactive`
  });
}
      const itmOffer = await getBestOffer(product._id, product.category?._id);
      const discountPct = itmOffer ? itmOffer.discount : (product.discount || 0);
      const salePrice = Math.round(unitPrice * (1 - discountPct / 100));

      totalPrice += salePrice * item.quantity;
      orderItems.push({
        product: product._id,
        variantId: item.variantId || null,
        quantity: item.quantity,
        price: salePrice,
        status: "Pending"
      });

      productsToUpdate.push({ productDoc: product, variantDoc: variantToUpdate, quantity: item.quantity });
    }

    const gst = Math.round(totalPrice * 0.18);
    let finalTotalPrice = totalPrice + gst;

    let couponDiscountAmount = 0;
    if (req.session.appliedCoupon) {
      const coupon = await Coupon.findOne({
        code: req.session.appliedCoupon,
        isActive: true,
        expiryDate: { $gte: new Date() }
      });

      if (!coupon) {
        delete req.session.appliedCoupon;
        return res.status(400).json({ success: false, message: "Coupon is no longer valid" });
      }

      const alreadyUsed = coupon.usedBy?.includes(userId.toString());
      if (alreadyUsed) {
        delete req.session.appliedCoupon;
        return res.status(400).json({ success: false, message: "You have already used this coupon" });
      }

      if (totalPrice < coupon.minOrderAmount) {
        return res.status(400).json({
          success: false,
          message: `Minimum order ₹${coupon.minOrderAmount} required for this coupon`
        });
      }

      if (coupon.discountType === 'percentage') {
        couponDiscountAmount = Math.round(totalPrice * (coupon.discountValue / 100));
        if (coupon.maxDiscountValue > 0) {
          couponDiscountAmount = Math.min(couponDiscountAmount, coupon.maxDiscountValue);
        }
      } else {
        couponDiscountAmount = coupon.discountValue;
      }

      // ✅ Ensure coupon doesn't make final price zero or negative
      if (couponDiscountAmount >= finalTotalPrice) {
        delete req.session.appliedCoupon;
        return res.status(400).json({
          success: false,
          message: "Coupon discount cannot exceed or equal the total price"
        });
      }

      finalTotalPrice -= couponDiscountAmount;

      await Coupon.findByIdAndUpdate(coupon._id, {
        $inc: { usedCount: 1 },
        $push: { usedBy: userId.toString() }
      });
    }

    // ✅ FIX #5: Single orderId declared once at the top, used throughout
    const orderId = "ORD" + Math.floor(100000 + Math.random() * 900000);

    let paymentStatus;
    if (paymentMethod === "COD") {
      paymentStatus = "Pending";

    } else if (paymentMethod === "Wallet") {
      const walletBalance = await walletService.getBalance(userId);
      if (walletBalance < finalTotalPrice) {
        return res.status(400).json({
          success: false,
          message: "Insufficient wallet balance"
        });
      }
      await walletService.debit(userId, finalTotalPrice,
        `Order payment for ${orderId}`, { orderRef: orderId });
      paymentStatus = "Paid";
} else if (paymentMethod === "Razorpay") {
    console.log("forcedPaymentStatus received:", forcedPaymentStatus);
  console.log("full req.body:", req.body);
  if (!forcedPaymentStatus) {
    return res.status(400).json({
      success: false,
      message: "Payment verification failed"
    });
  }
  paymentStatus = forcedPaymentStatus; // Already verified in verifyRazorpayPayment
} else {
      paymentStatus = "Pending";
    }

    if (paymentStatus !== "Failed") {
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
      discount: couponDiscountAmount,
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
      paymentStatus,
      orderStatus: "Pending",
      gst
    });

    await newOrder.save();

    if (paymentStatus !== "Failed") {
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

    res.render("user/orderSuccess", { order });
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

    res.render("user/payment-error", { order });
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

    res.render("user/orderDetails", { order });
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

    res.render("user/orders", { orders, search });
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
    if (!["Pending", "Processing"].includes(currentStatus)) {
      return res.status(400).json({ success: false, message: "Only pending items can be cancelled." });
    }

    item.status = "Cancelled";
    item.cancellationReason = reason || "No reason provided";

    // Restore stock
    const product = await Product.findById(item.product);
    if (product) {
      if (item.variantId && product.variants?.length > 0) {
        const variant = product.variants.find(v => v._id.toString() === item.variantId.toString());
        if (variant) variant.stock += item.quantity;
      } else {
        product.stock += item.quantity;
      }
      await product.save();
    }

    const itemTotalPrice = item.price * item.quantity;
    const orderSubtotal = order.orderItems.reduce((sum, i) => sum + i.price * i.quantity, 0);
    const discount = order.discount || 0;
    const discountRatio = orderSubtotal > 0 ? discount / orderSubtotal : 0;
    const itemAfterDiscount = itemTotalPrice * (1 - discountRatio);

    // Add proportional GST
    const gstRatio = orderSubtotal > 0 ? (order.gst || 0) / orderSubtotal : 0;
    const itemGst = itemTotalPrice * gstRatio;

    const refundAmount = parseFloat((itemAfterDiscount + itemGst).toFixed(2));

    order.totalPrice = Math.max(0, order.totalPrice - refundAmount);

    const allCancelled = order.orderItems.every(i => i.status === "Cancelled");
    if (allCancelled) order.orderStatus = "Cancelled";

    await order.save();

    const shouldRefund = order.paymentStatus === "Paid";
    if (shouldRefund && refundAmount > 0) {
      await walletService.refundForCancellation(
        userId,
        refundAmount,
        order._id,
        `${order.orderId}_${itemId}`
      );
    }

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

    const allReturnRequested = order.orderItems.every(
      i => i.status === "Return Requested" || i.status === "Cancelled"
    );
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

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=invoice-${order.orderId}.pdf`);

    doc.pipe(res);

    doc.fontSize(25).text('SNOVA', { align: 'right' });
    doc.fontSize(10).text('123 Fashion Street', { align: 'right' });
    doc.text('Calicut, Kerala, 673001', { align: 'right' });
    doc.text('GSTIN: 32AAAAA0000A1Z5', { align: 'right' });
    doc.moveDown();

    doc.fontSize(20).text('INVOICE', { underline: true });
    doc.moveDown();

    doc.fontSize(10).text(`Order ID: ${order.orderId}`);
    doc.text(`Date: ${new Date(order.createdAt).toLocaleDateString('en-GB')}`);
    doc.text(`Payment Method: ${order.paymentMethod}`);
    doc.moveDown();

    doc.fontSize(12).text('Bill To:', { underline: true });
    doc.fontSize(10).text(order.shippingAddress.fullName);
    doc.text(order.shippingAddress.addressline1);
    doc.text(`${order.shippingAddress.city}, ${order.shippingAddress.state}`);
    doc.text(`${order.shippingAddress.country} - ${order.shippingAddress.pincode}`);
    doc.text(`Phone: ${order.shippingAddress.phone}`);
    doc.moveDown();

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
      prepareRow: () => { doc.font("Helvetica").fontSize(10); },
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
      return res.status(400).json({ success: false, message: "Cart is empty" });
    }

    let totalPrice = 0;
    for (const item of cart.items) {
      const product = await Product.findById(item.productId._id || item.productId)
        .populate('category');
      if (!product || product.isBlocked || product.isDeleted) {
        return res.status(400).json({
          success: false,
          message: `A product in your cart is no longer available`
        });
      }
if (!product.category || product.category.isDeleted === true || product.isActive === false) {
  return res.status(400).json({
    success: false,
    message: `"${product.name}" is no longer available`
  });
}
      let unitPrice = product.salePrice || product.price;
      if (item.variantId && product.variants?.length > 0) {
        const variant = product.variants.find(v => v._id.toString() === item.variantId.toString());
        if (variant) {
          unitPrice = variant.salePrice || variant.price || unitPrice;
          if (variant.stock < item.quantity) {
            return res.status(400).json({
              success: false,
              message: `Insufficient stock for ${product.name}`
            });
          }
        }
      } else {
        if (product.stock < item.quantity) {
          return res.status(400).json({
            success: false,
            message: `Insufficient stock for ${product.name}`
          });
        }
      }

      const bestOffer = await getBestOffer(product._id, product.category?._id);
      const discountPct = bestOffer ? bestOffer.discount : (product.discount || 0);
      const salePrice = Math.round(unitPrice * (1 - discountPct / 100));
      totalPrice += salePrice * item.quantity;
    }

    const gst = Math.round(totalPrice * 0.18);
    let finalTotal = totalPrice + gst;

    let couponDiscountAmount = 0;
    if (req.session.appliedCoupon) {
      const coupon = await Coupon.findOne({
        code: req.session.appliedCoupon,
        isActive: true,
        expiryDate: { $gte: new Date() }
      });

      if (!coupon) {
        delete req.session.appliedCoupon;
        return res.status(400).json({ success: false, message: "Coupon is no longer valid" });
      }

      if (coupon.usedBy?.includes(userId.toString())) {
        delete req.session.appliedCoupon;
        return res.status(400).json({ success: false, message: "You have already used this coupon" });
      }

      if (totalPrice >= coupon.minOrderAmount) {
        if (coupon.discountType === 'percentage') {
          couponDiscountAmount = Math.round(totalPrice * (coupon.discountValue / 100));
          if (coupon.maxDiscountValue > 0) {
            couponDiscountAmount = Math.min(couponDiscountAmount, coupon.maxDiscountValue);
          }
        } else {
          couponDiscountAmount = coupon.discountValue;
        }

      
        if (couponDiscountAmount >= finalTotal) {
          delete req.session.appliedCoupon;
          return res.status(400).json({
            success: false,
            message: "Coupon discount cannot exceed or equal the total price"
          });
        }

        finalTotal -= couponDiscountAmount;
      }
    }

    if (finalTotal <= 0) {
      return res.status(400).json({ success: false, message: "Invalid order amount" });
    }

    const razorpayOrder = await razorpay.orders.create({
      amount: Math.round(finalTotal * 100),
      currency: "INR",
      receipt: `receipt_${Date.now()}`,
    });

    req.session.pendingOrderAmount = finalTotal;
    req.session.pendingCouponDiscount = couponDiscountAmount;

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

    console.log(req.body)
    const razorpayOrder = await razorpay.orders.fetch(razorpay_order_id);
    const expectedAmount = Math.round((req.session.pendingOrderAmount || 0) * 100);

    if (!req.session.pendingOrderAmount || razorpayOrder.amount !== expectedAmount) {
      console.warn(`Amount mismatch! Expected: ${expectedAmount}, Got: ${razorpayOrder.amount}`);
      return res.status(400).json({ success: false, message: "Payment amount mismatch" });
    }

    const body = razorpay_order_id + "|" + razorpay_payment_id;
    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(body)
      .digest("hex");

    if (expectedSignature !== razorpay_signature) {
      req.body.paymentMethod = "Razorpay";
      req.body.paymentStatus = "Failed";
      return placeOrder(req, res);
    }

    delete req.session.pendingOrderAmount;
    delete req.session.pendingCouponDiscount;

    req.body.paymentMethod = "Razorpay";
    req.body.paymentStatus = "Paid";
    return placeOrder(req, res);

  } catch (error) {
    console.error("verifyRazorpayPayment error:", error);
    res.status(500).json({ success: false, message: "Verification error" });
  }
};

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


    const alreadyUsed = coupon.usedBy?.includes(userId.toString());
    if (alreadyUsed) {
      return res.json({ success: false, message: "You have already used this coupon" });
    }


    let cart = await Cart.findOne({ userId }).populate("items.productId");
    if (!cart || cart.items.length === 0) {
      return res.json({ success: false, message: "Your cart is empty" });
    }

    let subtotal = 0;
    let discount = 0;

    await Promise.all(cart.items.map(async (item) => {
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

    // Calculate coupon discount
    let couponDiscount = 0;
    if (coupon.discountType === "flat") {
      couponDiscount = coupon.discountValue;
    } else if (coupon.discountType === "percentage") {
      couponDiscount = Math.round((coupon.discountValue / 100) * subtotalAfterDiscount);
      if (coupon.maxDiscountValue > 0 && couponDiscount > coupon.maxDiscountValue) {
        couponDiscount = coupon.maxDiscountValue;
      }
    }

    if (couponDiscount >= subtotalAfterDiscount) {
      return res.json({
        success: false,
        message: "Coupon discount cannot be equal to or exceed the total price"
      });
    }


    const finalPrice = subtotalAfterDiscount - couponDiscount;
    if (finalPrice <= 0) {
      return res.json({
        success: false,
        message: "Final price cannot be zero or negative after applying coupon"
      });
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
const retryRazorpayPayment = async (req, res) => {
  try {
    const userId = typeof req.session.user === 'object' ? req.session.user._id : req.session.user;
    const { orderId } = req.params;

    const order = await Order.findOne({ _id: orderId, userId }).populate("orderItems.product");
    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    if (order.paymentStatus !== "Failed" && order.paymentStatus !== "Pending") {
      return res.status(400).json({ success: false, message: "This order is not eligible for payment retry." });
    }

    for (const item of order.orderItems) {
      const product = item.product;
      if (!product || product.isBlocked || product.isDeleted) {
        return res.status(400).json({ success: false, message: `Product ${product?.name || 'Unknown'} is no longer available.` });
      }

      if (item.variantId && product.variants?.length > 0) {
        const variant = product.variants.find(v => v._id.toString() === item.variantId.toString());
        if (!variant || variant.stock < item.quantity) {
          return res.status(400).json({ success: false, message: `Insufficient stock for ${product.name}.` });
        }
      } else {
        if (product.stock < item.quantity) {
          return res.status(400).json({ success: false, message: `Insufficient stock for ${product.name}.` });
        }
      }
    }

    const finalTotal = order.totalPrice;
    if (finalTotal <= 0) {
      return res.status(400).json({ success: false, message: "Invalid order amount" });
    }

    const razorpayOrder = await razorpay.orders.create({
      amount: Math.round(finalTotal * 100),
      currency: "INR",
      receipt: `retry_${order._id.toString()}`,
    });

    res.json({
      success: true,
      orderId: razorpayOrder.id,
      amount: razorpayOrder.amount,
      currency: razorpayOrder.currency,
      keyId: process.env.RAZORPAY_KEY_ID,
    });
  } catch (error) {
    console.error("Retry Razorpay order creation error:", error);
    res.status(500).json({ success: false, message: "Could not initiate retry payment." });
  }
};

const verifyRetryPayment = async (req, res) => {
  try {
    const userId = typeof req.session.user === 'object' ? req.session.user._id : req.session.user;
    const { orderId } = req.params;
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

    const order = await Order.findOne({ _id: orderId, userId }).populate("orderItems.product");
    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    const body = razorpay_order_id + "|" + razorpay_payment_id;
    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(body)
      .digest("hex");

    if (expectedSignature !== razorpay_signature) {
      console.log("Signature mismatch! Expected:", expectedSignature, "Got:", razorpay_signature);
      return res.status(400).json({ success: false, message: "Invalid payment signature" });
    }

    console.log("Signature matched, proceeding to deduct stock");
  
    for (const item of order.orderItems) {
      const product = await Product.findById(item.product._id || item.product);
      if (product) {
        if (item.variantId && product.variants?.length > 0) {
          const variant = product.variants.find(v => v._id.toString() === item.variantId.toString());
          if (variant) {
            variant.stock -= item.quantity;
          }
        } else {
          product.stock -= item.quantity;
        }
        await product.save();
      }
    }

    order.paymentStatus = "Paid";
    await order.save();
    

    await Cart.findOneAndDelete({ userId });

    res.json({ success: true, message: "Payment successful" });

  } catch (error) {
    console.error("verifyRetryPayment error:", error);
    res.status(500).json({ success: false, message: "Verification error: " + error.message });
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
  recordPaymentFailure,
  retryRazorpayPayment,
  verifyRetryPayment
};