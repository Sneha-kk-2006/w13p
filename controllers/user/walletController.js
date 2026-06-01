const walletService = require('../../services/walletService');
const Razorpay = require('razorpay');
const crypto=require('crypto')

const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
});

const loadWallet = async (req, res) => {
    try {
        const userId = typeof req.session.user === 'object' ? req.session.user._id : req.session.user;
        
        if (!userId) {
            return res.redirect('/login');
        }

        const wallet = await walletService.getWallet(userId);

        res.render('user/wallet', {
            wallet,
            user: res.locals.user,
            razorpay:process.env.RAZORPAY_KEY_ID
        });
    } catch (error) {
        console.error('Error loading wallet:', error);
        res.status(500).render('user/errorPage', { message: 'Failed to load wallet' });
    }
};

const createRazorpayOrder=async(req,res)=>{
    try{
    const userId=req.session.user;
    const {amount}=req.body;

    if(!userId)  return res.status(401).json({success:false,message:"unauthorised"});
    
    const parsedAmount = parseFloat(amount);
    if(isNaN(parsedAmount) || parsedAmount <= 0 || parsedAmount > 100000) {
        return res.status(400).json({success:false,message:"invalid amount (must be between 1 and 100,000)"});
    }                                                                
     
        const order=await razorpay.orders.create({
            amount:Math.round(parsedAmount*100),
            currency:'INR',
             receipt: `wt_${Date.now()}`,
            notes:{userId:userId.toString(),purpose:'wallet Top-up'}
        })
          res.json({
            success: true,
            order,
            keyId: process.env.RAZORPAY_KEY_ID   // ← send key to frontend
        });
    

    }catch(error){
        console.log("error in razopay",error)
        res.status(500).json({ success: false, message: 'Failed to create payment order' });
    }
}


const addMoney = async (req, res) => {
    try {
        const userId = typeof req.session.user === 'object' ? req.session.user._id : req.session.user;
        const { razorpay_order_id, razorpay_payment_id, razorpay_signature, amount } = req.body;

        if (!userId) return res.status(401).json({ success: false, message: 'Unauthorized' });
        
        const parsedAmount = parseFloat(amount);
        if(isNaN(parsedAmount) || parsedAmount <= 0 || parsedAmount > 100000) {
            return res.status(400).json({ success: false, message: 'Invalid amount (must be between 1 and 100,000)' });
        }

        // ← fixed: verify all 3 razorpay fields are present
        if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
            return res.status(400).json({ success: false, message: 'Missing payment details' });
        }

        const generatedSignature = crypto
            .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
            .update(`${razorpay_order_id}|${razorpay_payment_id}`)
            .digest('hex');

        if (generatedSignature !== razorpay_signature) {
            return res.status(400).json({ success: false, message: 'Payment verification failed' });
        }

        const result = await walletService.credit(
            userId,
            parsedAmount,
            'Wallet Top-up',
            {
                type: 'credit',
                paymentId: razorpay_payment_id, 
                orderId: razorpay_order_id
            }
        );

        res.json({ success: true, message: 'Money added successfully', balance: result.wallet.balance });

    } catch (error) {
        console.error('Error adding money to wallet:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
};


module.exports = {
    loadWallet,
    addMoney,
   createRazorpayOrder
};
