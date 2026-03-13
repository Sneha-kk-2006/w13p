const mongoose=require('mongoose')


const connectDB=async (req,res)=>{
    try{
 await mongoose.connect(process.env.MONGODB_URI);
 console.log("DB connected")
    }catch(error){
console.log("db connected  error")
process.exit(1)
    }
}

module.exports=connectDB