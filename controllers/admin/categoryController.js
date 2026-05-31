const mongoose  = require('mongoose')
const category=require('../../models/categorySchema')


const loadp=async(req,res)=>{
    try{
       const search=req.query.search?.trim()||'';
       const page=parseInt(req.query.page)||1;
       const limit=5;
       const skip=(page-1)*limit;


       const filter={
        isDeleted:false
       }

       if(search){
        filter.name={$regex:search,$options:"i"};

       }

       const total=await category.countDocuments(filter);
       const categories=await category.find(filter).sort({createdAt:-1}).skip(skip).limit(limit);
       const totalPage=Math.ceil(total/limit)
     

   res.render('admin/categoryManagement',{categories,search,currentPage:page,totalPage,total,limit})
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
      name: { $regex: new RegExp(`^${name.trim()}$`,"i") },
      isDeleted: false
    });

    if (exists) {
      return res.status(400).json({ success: false, message: "Category already exists" });
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
           const exist = await category.findOne({
               name: { $regex: new RegExp(`^${name.trim()}$`, "i") },
               _id: { $ne: id },
               isDeleted: false
           });
          if (exist) {
      return res.status(400).json({ success: false, message: "Category already exists" });
    }
              //  return res.status(400).send("category name already exists");
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
  
    res.json({sucess:true,message:"category deleted"});

    }catch(error){
       res.json({message:"error deleting category"}) 
    }
}

const toggleCategoryStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const cat = await category.findById(id);
        if (!cat) return res.status(404).json({ message: "Category not found" });

        const newStatus = cat.status === 'Active' ? 'Inactive' : 'Active';
        await category.findByIdAndUpdate(id, { status: newStatus });

        res.json({ success: true, message: `Category is now ${newStatus}`, status: newStatus });
    } catch (error) {
        console.error("Toggle category error:", error);
        res.status(500).json({ message: "Server error" });
    }
}




module.exports={loadp,addCategory,editCategory,deleteCategory,toggleCategoryStatus}