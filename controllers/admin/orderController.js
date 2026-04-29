const Order = require("../../models/orderSchema");
const User = require("../../models/userSchema");
const Product = require("../../models/productSchema");

const loadOrders = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 10;
    const skip = (page - 1) * limit;

    const search = req.query.search || "";
    const filterStatus = req.query.status || "";
    const sortOrder = req.query.sort === "asc" ? 1 : -1;

    let query = {};

    if (search) {
      query.$or = [
        { orderId: { $regex: search, $options: "i" } },
        { "shippingAddress.fullName": { $regex: search, $options: "i" } }
      ];
    }

    if (filterStatus) {
      query.orderStatus = filterStatus;
    }

    const orders = await Order.find(query)
      .populate("userId")
      .sort({ createdAt: sortOrder })
      .skip(skip)
      .limit(limit);

    const totalOrders = await Order.countDocuments(query);
    const totalPages = Math.ceil(totalOrders / limit);

    res.render("admin/orderManagement", {
      orders,
      currentPage: page,
      totalPages,
      search,
      filterStatus,
      sortOrder: req.query.sort || "desc",
      activePage: 'orders'
    });
  } catch (error) {
    console.error("Error loading orders:", error);
    res.redirect("/admin/error");
  }
};

const updateOrderStatus = async (req, res) => {
  try {
    const { orderId, status } = req.body;
    
    const order = await Order.findOne({ orderId });
    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }
    if (order.orderStatus === "Delivered" && (status === "Pending" || status === "Shipped")) {
      return res.status(400).json({ success: false, message: "A delivered order cannot be set back to pending or shipped." });
    }
    if (order.orderStatus === "Cancelled" && status !== "Cancelled") {
      return res.status(400).json({ success: false, message: "A cancelled order cannot be changed to another status." });
    }
    if (order.orderStatus === "Returned" && status !== "Returned") {
      return res.status(400).json({ success: false, message: "A returned order cannot be changed to another status." });
    }

    if (status === "Returned" && order.orderStatus !== "Returned") {
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
    }

    order.orderStatus = status;
    await order.save();

    res.json({ success: true, message: "Order status updated successfully" });
  } catch (error) {
    console.error("Error updating order status:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

const viewOrderDetail = async (req, res) => {
  try {
    const orderId = req.params.id;
    const order = await Order.findOne({ orderId }).populate("userId").populate("orderItems.product");
    
    if (!order) {
      return res.redirect("/admin/error");
    }

    res.render("admin/orderDetail", { order, activePage: 'orders' });
  } catch (error) {
    console.error("Error viewing order detail:", error);
    res.redirect("/admin/error");
  }
};

module.exports = {
  loadOrders,
  updateOrderStatus,
  viewOrderDetail
};