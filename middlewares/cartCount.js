const Cart=require('../models/cartSchema');

const attachCartCount=async(req,res,next)=>{
    try{
        let userId = null;
        if (typeof req.session.user === "string") {
            userId = req.session.user;
        } else if (req.session.user && req.session.user._id) {
            userId = req.session.user._id;
        }

        if(userId){
            const cart = await Cart.findOne({userId:userId}).populate({
                path: 'items.productId',
                populate: { path: 'category' }
            });
            
            if (cart && cart.items) {
                const availableItems = cart.items.filter(item => 
                    item.productId && 
                    item.productId.isActive !== false && 
                    item.productId.isDeleted !== true &&
                    (!item.productId.category || (item.productId.category.isActive !== false && item.productId.category.isDeleted !== true))
                );
                res.locals.cartCount = availableItems.reduce((total, item) => total + item.quantity, 0);
            } else {
                res.locals.cartCount = 0;
            }
        }else{
            res.locals.cartCount=0;
        }
    }catch(error){
        console.log("cart count middleware error", error)
        res.locals.cartCount=0;
    }
    next();
}


module.exports=attachCartCount