const Order = require("../../models/orderSchema");
const Product = require("../../models/productSchema");
const walletService = require("../../services/walletService");


const loadOrders = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 10;
    const skip = (page - 1) * limit;

    const search = req.query.search || "";
    const filterStatus = req.query.status || "";
    const sortOrder = req.query.sort === "asc" ? 1 : -1;

    let query = {

    };
  
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

    const isCancelling = status === "Cancelled" && order.orderStatus !== "Cancelled";
    const isReturning = status === "Returned" && order.orderStatus !== "Returned";

    if (isCancelling || isReturning) {
      for (const item of order.orderItems) {
        if (!['Cancelled', 'Returned'].includes(item.status)) {
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
      
      // Refund for full order return or cancellation
      if ((order.paymentStatus === "Paid" || order.paymentMethod === "COD")&& order.totalPrice > 0) {
        if (isCancelling) {
          await walletService.refundForCancellation(
            order.userId,
            order.totalPrice,
            order._id,
            `cancel_full_${order.orderId}`
          );
        } else {
          await walletService.credit(
            order.userId,
            order.totalPrice,
            `Refund for returned order ${order.orderId}`,
            { type: 'refund_return', orderId: order._id, orderRef: order.orderId, idempotencyKey: `return_full_${order._id}` }
          );
        }
      }
      if (isCancelling) {
        order.totalPrice = 0;
      }
    }


    order.orderStatus = status;
    
    order.orderItems.forEach(item => {
      if (status === 'Returned' || status === 'Return Rejected') {
        if (item.status === 'Return Requested' || !['Cancelled', 'Returned', 'Return Rejected'].includes(item.status)) {
          item.status = status;
        }
      } else {
        if (!['Cancelled', 'Returned', 'Return Requested', 'Return Rejected'].includes(item.status)) {
          item.status = status;
        }
      }
    });

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

const updateItemStatus = async (req, res) => {
  try {
    const { orderId, itemId, status } = req.body;
    
    const order = await Order.findOne({ orderId });
    if (!order) return res.status(404).json({ success: false, message: "Order not found" });

    const item = order.orderItems.id(itemId);
    if (!item) return res.status(404).json({ success: false, message: "Item not found" });

    // Handle Stock Restoration and Price Reduction
    const isNewCancellation = status === "Cancelled" && item.status !== "Cancelled";
    const isNewReturn = status === "Returned" && item.status !== "Returned";

    if (isNewCancellation || isNewReturn) {
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

      if (status === "Cancelled") {
        const itemTotalPrice = item.price * item.quantity;
        const orderSubtotal = order.orderItems.reduce((sum, i) => sum + i.price * i.quantity, 0);
        const discount = order.discount || 0;
        const discountRatio = orderSubtotal > 0 ? discount / orderSubtotal : 0;
        const refundAmount = parseFloat((itemTotalPrice * (1 - discountRatio)).toFixed(2));

        order.totalPrice = Math.max(0, order.totalPrice - refundAmount);

        if ((order.paymentStatus === "Paid" || order.paymentMethod === "COD")&& refundAmount > 0) {
          await walletService.refundForCancellation(
            order.userId,
            refundAmount,
            order._id,
            `${order.orderId}_${itemId}`
          );
        }
      }


      if (isNewReturn && (order.paymentStatus === "Paid"|| order.paymentMethod === "COD")) {
        const itemTotalPrice = item.price * item.quantity;
        const orderSubtotal = order.orderItems.reduce((sum, i) => sum + i.price * i.quantity, 0);
        const discount = order.discount || 0;
        const discountRatio = orderSubtotal > 0 ? discount / orderSubtotal : 0;
        const refundAmount = parseFloat((itemTotalPrice * (1 - discountRatio)).toFixed(2));

        if (refundAmount > 0) {
          await walletService.refundForReturn(
            order.userId,
            refundAmount,
            order._id,
            order.orderId,
            item._id.toString()
          );
        }
      }
    }


    item.status = status;
    const allCancelled = order.orderItems.every(i => i.status === "Cancelled");
    const allReturned = order.orderItems.every(i => i.status === "Returned" || i.status === "Cancelled");
    
    if (allCancelled) order.orderStatus = "Cancelled";
    else if (allReturned) order.orderStatus = "Returned";

    await order.save();
    res.json({ success: true, message: "Item status updated" });
  } catch (error) {
    console.error("Error updating item status:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

module.exports = {
  loadOrders,
  updateOrderStatus,
  viewOrderDetail,
  updateItemStatus
};