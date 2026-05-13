const repo=require('../../repositories/admin/reportRepository')
const ExcelJS=require('exceljs')
const PDFDocument=require('pdfkit')




const getDashboardData = async (filter = 'monthly') => {
  const [salesData, topProducts, topCategories] = await Promise.all([
    repo.getSalesData(filter),
    repo.getTopProducts(),
    repo.getTopCategories(),

  ]);

  // Compute summary stats
  const totalRevenue = salesData.reduce((acc, curr) => acc + curr.revenue, 0);
  const totalOrders = salesData.reduce((acc, curr) => acc + curr.orders, 0);
  

  return { 
    salesData, 
    topProducts, 
    topCategories,
    summary: {
      totalRevenue,
      totalOrders,
    }
  };
};

const getSalesReportData = async (filter, startDate, endDate) => {
  const data = await repo.getSalesReport(filter, startDate, endDate);
  return data[0] || { totalSales: 0, totalAmount: 0, totalDiscount: 0, orders: [] };
};




const generateExcel = async (res, filter, startDate, endDate) => {
  const data = await getSalesReportData(filter, startDate, endDate);

  const workbook  = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Sales Report');

  sheet.addRow(['Order ID', 'Date', 'Customer ID', 'Amount', 'Discount', 'Payment']);
  data.orders.forEach(order => {
    sheet.addRow([
      order.orderId,
      new Date(order.createdAt).toLocaleDateString(),
      order.userId.toString(),
      order.totalPrice,
      order.discount || 0,
      order.paymentMethod
    ]);
  });

  sheet.addRow([]);
  sheet.addRow(['Total Sales', data.totalSales]);
  sheet.addRow(['Total Amount', data.totalAmount]);
  sheet.addRow(['Total Discount', data.totalDiscount]);

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', 'attachment; filename=sales_report.xlsx');
  await workbook.xlsx.write(res);
  res.end();
};



const generatePDF = async (res, filter, startDate, endDate) => {
  const data = await getSalesReportData(filter, startDate, endDate);

  const doc = new PDFDocument({ margin: 40 });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', 'attachment; filename=sales_report.pdf');
  doc.pipe(res);

  // Title
  doc.fontSize(20).text('SNOVA SALES REPORT', { align: 'center' }).moveDown();
  
  const period = startDate && endDate ? `${startDate} to ${endDate}` : filter.toUpperCase();
  doc.fontSize(10).text(`Period: ${period}`, { align: 'right' }).moveDown();

  doc.fontSize(12).text(`Total Orders: ${data.totalSales}`);
  doc.text(`Total Amount: ₹${data.totalAmount.toLocaleString()}`);
  doc.text(`Total Discount: ₹${data.totalDiscount.toLocaleString()}`).moveDown();

  // Table header
  doc.fontSize(10).text('Order ID', 50, 200);
  doc.text('Date', 150, 200);
  doc.text('Amount', 300, 200);
  doc.text('Discount', 400, 200);
  doc.text('Method', 500, 200);
  doc.moveTo(50, 215).lineTo(550, 215).stroke();

  let y = 230;
  data.orders.forEach(order => {
    if (y > 700) { doc.addPage(); y = 50; }
    doc.text(order.orderId, 50, y);
    doc.text(new Date(order.createdAt).toLocaleDateString(), 150, y);
    doc.text(`₹${order.totalPrice}`, 300, y);
    doc.text(`₹${order.discount || 0}`, 400, y);
    doc.text(order.paymentMethod, 500, y);
    y += 20;
  });

  doc.end();
};



module.exports = { getDashboardData, getSalesReportData, generateExcel, generatePDF };
