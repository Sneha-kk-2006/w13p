const mongoose  = require('mongoose')
const category=require('../../models/categorySchema')


const loadp=async(req,res)=>{
    try{
           const categories = await category.find({ isDeleted: false });
   res.render('admin/categoryManagement',{categories})
    }catch(error){
console.log(error)
    }
}



const addCategory = async (req, res) => {
  try {
    const { name, isActive } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ message: "Name required" });
    }

    
    const exists = await category.findOne({
      name: name.trim(),
      isDeleted: false
    });

    if (exists) {
      return res.status(400).json({ message: "Category already exists" });
    }

    await category.create({
      name: name.trim(),
      status: isActive ? "Active" : "Inactive",
      isDeleted: false
    });

    return res.status(201).json({
      success: true,
      message: "Category added successfully"
    });

  } catch (error) {
    console.log("Error in addCategory:", error);

    return res.status(500).json({
      message: "Server error"
    });
  }
};


const editCategory=async(req,res)=>{
    try{
        const {id}=req.params;
        const {name,isActive}=req.body;
        if(!name||!name.trim())
            return res.status(400).send("name required")
           const exist=await category.findOne({name:name.trim(),_id:{$ne:id},isDeleted:false});
           if(exist)
            return res.status(400).send("category name is already exists");
        await category.findByIdAndUpdate(id,{
            name:name.trim(),
            status:isActive?"Active":"Inactive"
        })
     res.json({ message: 'Category edited successfully' });
    }catch(error){
  console.error(error)
  res.status(500).send("server error")
    }
}



const deleteCategory=async(req,res)=>{
    try{
    const {id}=req.params;
    await category.findByIdAndUpdate(id,{
        isDeleted:true
    });
    res.json({success:true,message:"category deleted"});

    }catch(error){
       res.json({message:"error deleting category"}) 
    }
}



module.exports={loadp,addCategory,editCategory,deleteCategory}