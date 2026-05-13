const reportService=require('../../services/admin/reportService')
const  reportRepo=require('../../repositories/admin/reportRepository')



const getDashboard = async (req, res) => {
  try {
    const filter = req.query.filter || 'monthly';
    const data   = await reportService.getDashboardData(filter);
    res.render('admin/dashboard', { ...data, filter });
  } catch (err) {
    console.error('Dashboard error:', err);
    res.status(500).send('Server error');
  }
};

const getSalesReport = async (req, res) => {
  try {
    const filter = req.query.filter || 'monthly';
    const startDate = req.query.startDate || '';
    const endDate = req.query.endDate || '';
    
    const data = await reportService.getSalesReportData(filter, startDate, endDate);
    res.render('admin/salesreport', { ...data, filter, startDate, endDate });
  } catch (err) {
    console.error('Sales report error:', err);
    res.status(500).send('Server error');
  }
};


const getChartData = async (req, res) => {
  try {
    const filter    = req.query.filter || 'monthly';
    const salesData = await reportRepo.getSalesData(filter);
    res.json({ success: true, salesData });
  } catch (err) {
    res.status(500).json({ success: false });
  }
};


const downloadExcel = async (req, res) => {
  try {
    const { filter, startDate, endDate } = req.query;
    await reportService.generateExcel(res, filter || 'monthly', startDate, endDate);
  } catch (err) {
    console.error('Excel error:', err);
    res.status(500).send('Failed to generate Excel');
  }
};

const downloadPDF = async (req, res) => {
  try {
    const { filter, startDate, endDate } = req.query;
    await reportService.generatePDF(res, filter || 'monthly', startDate, endDate);
  } catch (err) {
    console.error('PDF error:', err);
    res.status(500).send('Failed to generate PDF');
  }
};


const getLedger = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const ledger = await reportRepo.getLedgerData(startDate, endDate);
    res.render('admin/ledger', { ledger, startDate, endDate });
  } catch (err) {
    console.error('Ledger error:', err);
    res.status(500).send('Server error');
  }
};

module.exports = { getDashboard, getSalesReport, getChartData, downloadExcel, downloadPDF, getLedger };