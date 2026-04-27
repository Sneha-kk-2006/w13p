const Cart = require("../../models/cartSchema");
const Address = require("../../models/addressSchema");
const Product = require("../../models/productSchema");
const Order = require("../../models/orderSchema");

const loadCheckout = async (req, res) => {
  try {
    const userId = typeof req.session.user === 'object' ? req.session.user._id : req.session.user;

    // Fetch Cart
    let cart = await Cart.findOne({ userId }).populate({
      path: "items.productId",
      populate: { path: "category" },
    });

    if (!cart || cart.items.length === 0) {
      return res.redirect("/cart");
    }

    // Filter and Map Cart Items (Sync with cartController logic)
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

    // Fetch Addresses
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
          // Check Stock
          if (variant.stock < item.quantity) {
            return res.status(400).json({ success: false, message: `Insufficient stock for ${product.name} (${variant.size}/${variant.color})` });
          }
          // Update Stock
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

module.exports = {
  loadCheckout,
  placeOrder,
  loadOrderSuccess,
  loadOrderDetails,
  loadOrders
};
