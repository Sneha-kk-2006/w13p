const mongoose = require("mongoose");

const {Schema}=mongoose;
const userSchema= new Schema({
    name:{
        type:String,
        required:true
    },
    email:{
        type:String,
        required:true
    },

  phone:{
    type:String
  },
    googleId:{
        type:String,
        unique:true,
        sparse:true
    },
    password:{
        type:String,
        required:false//bcz we don't entering password during the single signup
    },
    profileImage:{
        type:String,
        required:false
    },
    isBlocked:{
        type:Boolean,

    },
    isAdmin:{
    type:Boolean,
    default:false
    },
    cart:[{

    }],
    createdOn:{
        type:Date,
        default:Date.now,
    }

})

const User=mongoose.model("User",userSchema)
module.exports=User