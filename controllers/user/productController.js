const Product = require('../../models/productSchema');
const Review=require('../../models/reviewSchema')



const getProducts = async (req, res) => {
  try {
    const products = await Product.find({ 
      isDeleted: { $ne: true },  // ✅ fixed
      isActive:  { $ne: false }  // ✅ fixed
    }).populate('category');

    console.log('Products found:', products.length);

    res.render('user/products', { products });
  } catch (err) {
    console.error(err);
    res.redirect('/');
  }
};



const loadProductDetails=async(req,res)=>{
  try{
    const product=await Product.findById(req.params.id).populate('category')
    console.log("product ",product)
   if(!product||product.isDeleted||!product.isActive){
    return res.redirect('/products')
   }
   
   const relatedProducts=await Product.find({
    category:product.category.id,
    _id:{$ne:product.id},
    isDeleted:false,
    status:'Active'
   }).limit(4)


   console.log(relatedProducts)
  const reviews=await Review.find({productId:product.id}).populate('userId','name')

  const avgRating=reviews.length?(reviews.reduce((sum,r)=>sum+r.rating,0)/reviews.length).toFixed(1):0;

  res.render('user/productDetails',{
    product,
    relatedProducts,
    reviews,
    avgRating,
    user:req.session.user,
    
    
  })

  }catch(error){
console.error(error);
        res.redirect('/products');
  }
}



module.exports = { getProducts,loadProductDetails };