const express=require('express')
const router=express.Router()

const Address=require('../../models/addressSchema')


// load address page

const loadAddress = async(req,res)=>{

try{

const userId = req.session.user

const addresses = await Address.find({userId})
console.log(addresses)
res.render("user/address",{addresses})

}catch(err){
console.log(err)
}

}


// add address


const addAddress=async(req,res)=>{
    try{
     const userId=req.session.user
      console.log(userId)
     const {fullName,phone,type,addressline1,addressline2,country,city,state,pincode}=req.body

     const newAddress=new Address({
        userId,
        fullName,
        phone,
        type,
        addressline1,
        addressline2,
        city,
        country,
        state,
        pincode

     })
    await newAddress.save()
    console.log("Address saved")
    res.redirect('user/address')

    }catch(error){
  console.log("error",error)
    }
}





module.exports={loadAddress,addAddress}