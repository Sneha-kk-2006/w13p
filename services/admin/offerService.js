const Offer=require('../../models/offerSchema')
const Product=require('../../models/productSchema')


const getBestOffer=async(productId,categoryId)=>{
    const now =new Date();
    const offers=await Offer.find({
        isActive:true,
        startDate:{$lte:now},
        endDate:{$gte:now},
        $or:[
            {type:'product',productId:productId},
            {type:'category',categoryId:categoryId}
        ]
    });
    if(!offers.length) return null;
    return offers.reduce((best,offer)=>{
        return (offer.discountValue>(best?.discountValue||0))?offer:best;
    },null);
};


const calulateDiscountPrice=(original,offer)=>{
    if(!offer) return originalPrice;
    let discount=0;

    if(offer.discountType==='percentage'){
        discount=(originalPrice*offer.discountValue)/100;
        if(offer.maxDiscount)discount=Math.min(discount,offer.maxDiscount);
    }else{
        discount=offer.discountValue;
    }
    return Math.max(0,originalPrice-discount);
}



module.exports={getBestOffer,calulateDiscountPrice};