const Offer = require('../../models/offerSchema');
const Product = require('../../models/productSchema');
const Category = require('../../models/categorySchema');

const loadoffers = async (req, res) => {
    try {
        const offers = await Offer.find()
            .populate('product', 'name')
            .populate('category', 'name')
            .sort({ createdAt: -1 });
        
    
        const products = await Product.find({ isListed: true, isDeleted: false }, 'name');
        
      
        const categories = await Category.find({ status: 'Active', isDeleted: false }, 'name');
        
        res.render('admin/offers', { offers, products, categories });
    } catch (error) {
        console.log("error loading offers", error);
        res.status(500).render('admin/error', { message: 'failed to load' });
    }
};

const addOffer = async (req, res) => {
    try {
        const { name, offerType, referenceId, discount, startDate, endDate } = req.body;
        
        // Validations
        if (!name || name.trim().length < 3) return res.status(400).json({ success: false, message: "Name must be at least 3 characters long" });
        if (!/^[a-zA-Z0-9\s\-_.%&]+$/.test(name.trim())) return res.status(400).json({ success: false, message: "Name contains invalid characters" });
        
        if (!offerType || !['product', 'category'].includes(offerType)) return res.status(400).json({ success: false, message: "Invalid offer type" });
        if (!referenceId) return res.status(400).json({ success: false, message: "Please select a product or category" });
        
        const discNum = parseFloat(discount);
        if (isNaN(discNum) || discNum <= 0 || discNum > 100) return res.status(400).json({ success: false, message: "Discount must be between 1 and 100" });
        
        const start = new Date(startDate);
        const end = new Date(endDate);
        const today = new Date();
        today.setHours(0,0,0,0);
        
        if (isNaN(start.getTime()) || isNaN(end.getTime())) return res.status(400).json({ success: false, message: "Invalid dates provided" });
        if (start < today) return res.status(400).json({ success: false, message: "Start date cannot be in the past" });
        if (end <= start) return res.status(400).json({ success: false, message: "End date must be after start date" });

        const offerData = { name: name.trim(), offerType, discount: discNum, startDate: start, endDate: end };
        
        if (offerType === 'product') {
            offerData.product = referenceId;
        } else if (offerType === 'category') {
            offerData.category = referenceId;
        }
        const offer = new Offer(offerData);
        await offer.save();
        res.json({ success: true, message: "Offer added successfully" });
    } catch (error) {
        console.error("error adding offer:", error);
        res.status(500).json({ success: false, message: error.message || "Error adding offer" });
    }
};



const toggleOfferStatus = async (req, res) => {
    try {
        const offer = await Offer.findById(req.params.id);
        if (!offer) return res.status(404).json({ success: false, message: "Offer not found" });
        
        offer.isActive = !offer.isActive;
        await offer.save();
        res.json({ success: true, message: "Status updated successfully" });
    } catch (error) {
        console.log("error toggling offer", error);
        res.status(500).json({ success: false, message: "Error updating status" });
    }
};

const deleteOffer = async (req, res) => {
    try {
        await Offer.findByIdAndDelete(req.params.id);
        res.json({ success: true, message: "Offer deleted successfully" });
    } catch (error) {
        console.log("error deleting offer", error);
        res.status(500).json({ success: false, message: "Error deleting offer" });
    }
};

module.exports = { loadoffers, addOffer, toggleOfferStatus, deleteOffer };
