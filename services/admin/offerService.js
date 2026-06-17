const Offer=require('../../models/offerSchema')
const Product=require('../../models/productSchema')
const offerRepo=require('../../repositories/admin/offerRepo')


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



const editOffer = async (id, body) => {
  const { name, offerType, referenceId, discount, startDate, endDate } = body;


  if (!name || name.trim().length < 3)
    throw { status: 400, message: "Name must be at least 3 characters" };
  if (!/^[a-zA-Z0-9\s\-_.%&]+$/.test(name.trim()))
    throw { status: 400, message: "Name contains invalid characters" };


  if (!offerType || !['product', 'category'].includes(offerType))
    throw { status: 400, message: "Invalid offer type" };
  if (!referenceId)
    throw { status: 400, message: "Please select a product or category" };


  const discNum = parseFloat(discount);
  if (isNaN(discNum) || discNum <= 0 || discNum > 100)
    throw { status: 400, message: "Discount must be between 1 and 100" };

 
    const start = new Date(startDate);
        const end = new Date(endDate);
        const today = new Date();
        today.setHours(0,0,0,0);
        
        if (isNaN(start.getTime()) || isNaN(end.getTime())) return res.status(400).json({ success: false, message: "Invalid dates provided" });
        if (start < today) throw{ status:400,success: false, message: "Start date cannot be in the past" };
        if (end <= start) throw{ status:400,success: false, message: "End date must be after start date" };


  const existing = await offerRepo.findOfferById(id);
  if (!existing)
    throw { status: 404, message: "Offer not found" };

  const updateData = {
    name: name.trim(),
    offerType,
    discount: discNum,
    startDate: start,
    endDate: end,
    product:  offerType === 'product'  ? referenceId : null,
    category: offerType === 'category' ? referenceId : null,
  };

  return await offerRepo.updateOffer(id, updateData);
};


module.exports={getBestOffer,calulateDiscountPrice,editOffer};