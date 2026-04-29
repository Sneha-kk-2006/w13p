const Cart = require("../../models/cartSchema");
const Address = require("../../models/addressSchema");
const Product = require("../../models/productSchema");
const Order = require("../../models/orderSchema");

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

    const mappedItems = cart.items.map((item) => {
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

      const discountPct = product.discount || 0;
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
    });

    const total = subtotal - discount;

    const addresses = await Address.find({ userId });

    res.render("user/checkout", {
      items: mappedItems,
      subtotal,
      discount,
      total,
      addresses,
    });
  } catch (error) {
    console.error("loadCheckout error:", error);
    res.status(500).send("Server Error");
  }
};

const placeOrder = async (req, res) => {
  try {
    const userId = typeof req.session.user === 'object' ? req.session.user._id : req.session.user;
    const { addressId, paymentMethod } = req.body;

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

    for (const item of cart.items) {
      const product = item.productId;

      if (!product) {
        console.warn("Item in cart has no associated product:", item._id);
        continue;
      }

      let unitPrice = product.price || 0;

      if (item.variantId && product.variants && product.variants.length > 0) {
        const variant = product.variants.find(v => v._id.toString() === item.variantId.toString());
        if (variant) {
          unitPrice = variant.price || unitPrice;
          
          if (variant.stock < item.quantity) {
            return res.status(400).json({ success: false, message: `Insufficient stock for ${product.name} (${variant.size}/${variant.color})` });
          }
         
          variant.stock -= item.quantity;
        }
      } else {
        if (product.stock < item.quantity) {
          return res.status(400).json({ success: false, message: `Insufficient stock for ${product.name}` });
        }
        product.stock -= item.quantity;
      }

      const discountPct = product.discount || 0;
      const salePrice = Math.round(unitPrice * (1 - discountPct / 100));
      totalPrice += salePrice * item.quantity;

      orderItems.push({
        product: product._id,
        variantId: item.variantId,
        quantity: item.quantity,
        price: salePrice
      });

      await product.save();
    }

    const orderId = "ORD" + Math.floor(100000 + Math.random() * 900000);

    const newOrder = new Order({
      orderId,
      userId,
      orderItems,
      totalPrice,
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
      paymentStatus: paymentMethod === "COD" ? "Pending" : "Paid",
      orderStatus: "Pending"
    });

    console.log("Saving new order:", orderId);
    await newOrder.save();

    // Clear Cart
    await Cart.findOneAndDelete({ userId });

    console.log("Order placed successfully:", orderId);
    res.json({ success: true, orderId: newOrder._id });

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

const loadOrderDetails = async (req, res) => {
  try {
    const orderId = req.params.id;
    const order = await Order.findById(orderId).populate("orderItems.product");

    if (!order) {
      return res.redirect("/profile");
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
    const orders = await Order.find({ userId }).sort({ createdAt: -1 });

    res.render("user/orders", {
      orders
    });
  } catch (error) {
    console.error("loadOrders error:", error);
    res.status(500).send("Server Error");
  }
};

const cancelOrder = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { reason } = req.body;
    const userId = typeof req.session.user === 'object' ? req.session.user._id : req.session.user;

    const order = await Order.findOne({ _id: orderId, userId });
    
    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }
    
    // Check if the order is already cancelled or returned, or if it's shipped/delivered
    if (order.orderStatus !== "Pending") {
      return res.status(400).json({ success: false, message: "Only pending orders can be cancelled." });
    }

    // Update order status and store reason
    order.orderStatus = "Cancelled";
    order.cancellationReason = reason || "No reason provided";

    // Restore stock
    for (const item of order.orderItems) {
      const product = await Product.findById(item.product);
      if (product) {
        if (item.variantId && product.variants && product.variants.length > 0) {
          const variant = product.variants.find(v => v._id.toString() === item.variantId.toString());
          if (variant) {
            variant.stock += item.quantity;
          }
        } else {
          product.stock += item.quantity;
        }
        await product.save();
      }
    }
    
    await order.save();
    return res.json({ success: true, message: "Order cancelled successfully." });
    
  } catch (error) {
    console.error("cancelOrder error:", error);
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

const returnOrder = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { reason } = req.body;
    const userId = typeof req.session.user === 'object' ? req.session.user._id : req.session.user;

    const order = await Order.findOne({ _id: orderId, userId });
    
    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }
    
    if (order.orderStatus !== "Delivered") {
      return res.status(400).json({ success: false, message: "Only delivered orders can be returned." });
    }

    order.orderStatus = "Return Requested";
    order.returnReason = reason || "No reason provided";
    
    await order.save();
    return res.json({ success: true, message: "Return request submitted successfully." });
    
  } catch (error) {
    console.error("returnOrder error:", error);
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
        const table = {
            title: "Order Items",
            headers: ["Product", "Quantity", "Price", "Total"],
            rows: order.orderItems.map(item => [
                item.product ? item.product.name : "Product Removed",
                item.quantity.toString(),
                `INR ${item.price.toLocaleString()}`,
                `INR ${(item.quantity * item.price).toLocaleString()}`
            ]),
        };

        await doc.table(table, {
            prepareHeader: () => doc.font("Helvetica-Bold").fontSize(10),
            prepareRow: (row, indexColumn, indexRow, rectRow, rectCell) => {
                doc.font("Helvetica").fontSize(10);
            },
        });

        doc.moveDown();
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


module.exports = {
  loadCheckout,
  placeOrder,
  loadOrderSuccess,
  loadOrderDetails,
  loadOrders,
  cancelOrder,
  clearAllOrders,
  returnOrder,
  downloadInvoice
};
