const Order = require('../../models/orderSchema');



const getSalesData = async (filter) => {
  let matchStage;
  let groupBy;

  const now = new Date();
  if (filter === 'weekly') {
    matchStage = { createdAt: { $gte: new Date(now.setDate(now.getDate() - 7)) } };
    groupBy = { week: { $week: '$createdAt' }, year: { $year: '$createdAt' } };
  } else if (filter === 'monthly') {
    matchStage = { createdAt: { $gte: new Date(now.setMonth(now.getMonth() - 1)) } };
    groupBy = { month: { $month: '$createdAt' }, year: { $year: '$createdAt' } };
  } else if (filter === 'yearly') {
    matchStage = { createdAt: { $gte: new Date(now.setFullYear(now.getFullYear() - 1)) } };
    groupBy = { year: { $year: '$createdAt' } };
  } else {
    // Default to monthly if invalid
    matchStage = { createdAt: { $gte: new Date(now.setMonth(now.getMonth() - 1)) } };
    groupBy = { month: { $month: '$createdAt' }, year: { $year: '$createdAt' } };
  }

  return await Order.aggregate([
    { $match: { orderStatus: 'Delivered', ...matchStage } },
    {
      $group: {
        _id: groupBy,
        revenue: { $sum: '$totalPrice' },
        orders: { $sum: 1 }
      }
    },
    { $sort: { '_id.year': 1, '_id.month': 1, '_id.week': 1 } }
  ]);
};

const getSalesReport = async (filter, startDate, endDate, page , limit ) => {
  let matchStage = { orderStatus: 'Delivered' };

  if (startDate && endDate) {
    matchStage.createdAt = {
      $gte: new Date(startDate),
      $lte: new Date(endDate)
    };
  } else {
    // const now = new Date();
    if (filter === 'daily') {
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);
      matchStage.createdAt = { $gte: startOfDay };
    } else if (filter === 'weekly') {
      const lastWeek = new Date();
      lastWeek.setDate(lastWeek.getDate() - 7);
      matchStage.createdAt = { $gte: lastWeek };
    } else if (filter === 'yearly') {
      const lastYear = new Date();
      lastYear.setFullYear(lastYear.getFullYear() - 1);
      matchStage.createdAt = { $gte: lastYear };
    } else {
      // monthly
      const lastMonth = new Date();
      lastMonth.setMonth(lastMonth.getMonth() - 1);
      matchStage.createdAt = { $gte: lastMonth };
    }
  }
   const skip = (page - 1) * limit;

  // Run summary + paginated orders in parallel
  const [summary, orders, totalCount] = await Promise.all([

    // Summary — always from ALL matched orders (not paginated)
    Order.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: null,
          totalSales: { $sum: 1 },
          totalAmount: { $sum: '$totalPrice' },
          totalDiscount: { $sum: '$discount' },
        }
      }
    ]),

    // Paginated orders list
    Order.find(matchStage)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
       .populate('userId', 'name')
      .lean(),

    // Total count for pagination
    Order.countDocuments(matchStage)
  ]);;



  return {
    summary: summary[0] || { totalSales: 0, totalAmount: 0, totalDiscount: 0 },
    orders,
    pagination: {
      currentPage: page,
      totalPages: Math.ceil(totalCount / limit),
      totalItems: totalCount,
      limit
    }
    };
}
  // return await Order.aggregate([
  //   { $match: matchStage },
  //   {
  //     $group: {
  //       _id: null,
  //       totalSales: { $sum: 1 },
  //       totalAmount: { $sum: '$totalPrice' },
  //       totalDiscount: { $sum: '$discount' },
  //       orders: { $push: '$$ROOT' }
  //     }
  //   }
  // ]);
// };

const getTopProducts = async () => {
  return await Order.aggregate([
    { $match: { orderStatus: 'Delivered' } },
    { $unwind: '$orderItems' },
    {
      $group: {
        _id: '$orderItems.product',
        totalQty: { $sum: '$orderItems.quantity' },
        revenue: { $sum: { $multiply: ['$orderItems.price', '$orderItems.quantity'] } }
      }
    },
    { $sort: { totalQty: -1 } },
    { $limit: 10 },
    {
      $lookup: {
        from: 'products',
        localField: '_id',
        foreignField: '_id',
        as: 'productInfo'
      }
    },
    { $unwind: '$productInfo' },
    {
      $project: {
        name: '$productInfo.name',
        image: { $arrayElemAt: ['$productInfo.images', 0] },
        totalQty: 1,
        revenue: 1
      }
    }
  ]);
};

const getTopCategories = async () => {
  return await Order.aggregate([
    { $match: { orderStatus: 'Delivered' } },
    { $unwind: '$orderItems' },
    {
      $lookup: {
        from: 'products',
        localField: 'orderItems.product',
        foreignField: '_id',
        as: 'productInfo'
      }
    },
    { $unwind: '$productInfo' },
    {
      $lookup: {
        from: 'categories',
        localField: 'productInfo.category',
        foreignField: '_id',
        as: 'categoryInfo'
      }
    },
    { $unwind: '$categoryInfo' },
    {
      $group: {
        _id: '$categoryInfo.name',
        totalQty: { $sum: '$orderItems.quantity' },
        revenue: { $sum: { $multiply: ['$orderItems.price', '$orderItems.quantity'] } }
      }
    },
    {
      $project: {
        _id: 0,
        name: '$_id',
        totalQty: 1,
        revenue: 1
      }
    },
    { $sort: { totalQty: -1 } },
    { $limit: 10 }
  ]);
};

const getLedgerData = async (startDate, endDate) => {
  let matchStage = { orderStatus: 'Delivered' };
  if (startDate && endDate) {
    matchStage.createdAt = {
      $gte: new Date(startDate),
      $lte: new Date(endDate)
    };
  }
  return await Order.find(matchStage).sort({ createdAt: -1 });
};

module.exports = {
  getSalesData,
  getSalesReport,
  getTopProducts,
  getTopCategories,
  getLedgerData
};