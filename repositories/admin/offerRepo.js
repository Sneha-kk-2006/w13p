const Offer=require('../../models/offerSchema')

const findOfferById = async (id) => {
  return await Offer.findById(id);
};

const updateOffer = async (id, updateData) => {
  return await Offer.findByIdAndUpdate(id, updateData, { new: true, runValidators: true });
};

module.exports={findOfferById,updateOffer}