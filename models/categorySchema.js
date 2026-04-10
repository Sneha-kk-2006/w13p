const mongoose=require('mongoose')
const {Schema}= mongoose;

const categorySchema = new Schema(
    {
name: { type: String, required: true, trim: true },
isDeleted: { type: Boolean, default: false },
createdAt: { type: Date, default: Date.now }     

    }
)


const category=mongoose.model("category" ,categorySchema);

module.exports=category