const mongoose = require("mongoose");
const user=require('../models/userSchema')
const addressSchema = new mongoose.Schema({

    userId:{
        type:mongoose.Schema.Types.ObjectId,
        ref:"User",
        required:true
    },

    fullName:{
        type:String,
        required:true
    },

    phone:{
        type:String,
        required:true
    },

    type:{
        type:String,
        enum:["home","work"],
        required:false
    },

    city:{
        type:String,
        required:true
    },

    state:{
        type:String,
        required:true
    },

    pincode:{
        type:String,
        required:true
    },
    country:{
        type:String,
        required:true
    },
    addressline1:{
        type:String,
        required:true
    },
    addressline2:{
        type:String,
        required:false
    },

    isDefault:{
        type:Boolean,
        default:false
    }

},{timestamps:true})

module.exports = mongoose.model("Address",addressSchema)