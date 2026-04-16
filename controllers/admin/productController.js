const product=require('../../models/productSchema');
const category=require('../../models/categorySchema')


const loadProduct = async (req, res) => {
    try {
        const search = req.query.search || '';
        const currentPage = parseInt(req.query.page) || 1;
        const limit = 10; // products per page

        const totalProducts = await product.countDocuments({
            name: { $regex: search, $options: 'i' }
        });
        let filter={
            isDeleted:false,
             name: { $regex: search, $options: 'i' }
        }

        const totalPages = Math.ceil(totalProducts / limit);

        const products = await product.find(filter)
        .populate('category')
        .skip((currentPage - 1) * limit)
        .limit(limit);
        const categories = await category.find();
        res.render('admin/product', {
            products,
            search,
            currentPage,
            totalPages,
            limit,
            total:totalProducts,
            categories,
              editProduct: null 
        });
    // add temporarily in loadProduct
console.log('images:', products[0]?.images);
    } catch (error) {
        console.error(error);
        res.redirect('/pageError');
    }
};



const addProduct = async (req, res) => {
    try {

        const { name, description ,image,price,stock,category} = req.body;

        const images = req.files?.map(file =>'/uploads/products/'+ file.filename) || [];
        const stockVal=parseInt(stock);
        if(isNaN(stockVal)||stockVal<0){
            return res.status(400).json({success:false,message:'invalid stock value'})
        }
        const existing=await product.findOne({name});
        if(existing){
            return res.status(400).json({success:false,message :"product already exists"})
        }
        if(price<0){
              return res.status(400).json({success:false,message :"price not negative"})
        }
        const newProduct = new product({  
            name,
            description,
            images,
            price,
            stock:stockVal,
            category,
            isActive: true,
            isDeleted: false
        });


        console.log("new product",newProduct)

        await newProduct.save();
   res.json({ success: true, message: 'Product added successfully' });
      

    } catch (error) {
        console.log("error1", error);
        res.status(500).send("Server error");
    }
};




const editProduct=async(req,res)=>{
    try{
    const {name,description,price,stock,category}=req.body;
    let updateData={
        name,description,price,stock,category
    };

    const stockVal=parseInt(stock);
    if(!isNaN(stockVal)||stockVal<0){
        return res.status(400).json({success:false,message:"invalid stock value"})
    }

     let update = { name, description, price, stock: stockVal, category };
      console.log(update)

    if(req.files&& req.files.length>0){
        const images=req.files.map(file=>file.filename);
        updateData.image = req.files.map(file=>'/uploads/products/'+file.filename);
    }
    await product.findByIdAndUpdate(req.params.id,updateData)
     res.json({ success: true, message: 'Product updated successfully' });
    res.redirect('/admin/product')
    }catch(error){
        console.log("error",error)
    }
}



const deleteProduct = async (req, res) => {
    try {

        await product.findByIdAndUpdate(req.params.id, { isDeleted: true });
  console.log("deleted")
        res.json({ success: true, message: 'Product deleted successfully' });

    } catch (error) {
        console.log('deleteProduct error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};


const toggleProductStatus = async (req, res) => {
    try {
        const products = await product.findById(req.params.id);
        products.isActive = !products.isActive;
        await products.save();
        res.json({ 
            success: true, 
            status: products.isActive ? 'Active' : 'Inactive' 
        });
    } catch (error) {
        console.log("error", error);
        res.status(500).json({ success: false, message: 'Something went wrong' });
    }
}





module.exports={loadProduct, addProduct,editProduct,deleteProduct,toggleProductStatus}