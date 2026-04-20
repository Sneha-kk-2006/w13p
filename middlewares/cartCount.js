const Cart=require('../models/cartSchema');

const attachCartCount=async(req,res,next)=>{
    try{
        if(req.session?.user?._id){
            const cart=await Cart.findOne({userId:req.session.user._id});
            res.locals.cartCount=cart?cart.items.length:0;

        }else{
            res.locals.cartCount=0;
        }

    }catch(error){
        console.log("cart count middleware error")
        res.locals.cartCount=0;
    }

    next();

}


module.exports=attachCartCount