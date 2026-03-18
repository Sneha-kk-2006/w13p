
const Address=require('../../models/addressSchema')


// load address page

const loadAddress = async (req, res) => {
    try {
        const userId = req.session.user;
        const addresses = await Address.find({ userId });
        console.log(addresses)
        res.render("user/address", { addresses });
    } catch (err) { 

        console.log(err);
        res.redirect('/errorPage');
        }
}


// add address


const addAddress = async (req, res) => {
    try {
        const userId = req.session.user;
        const { fullName, phone, type, addressline1, addressline2, country, city, state, pincode } = req.body;
        console.log(req.body)
        const newAddress = new Address({
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
        });
        await newAddress.save();
        res.redirect('/address');
    } catch (error) {

        console.log("error", error);
        res.redirect('/address');
    }
}

const deleteAddress = async (req, res) => {
    try {
        const addressId = req.query.id;
        await Address.findByIdAndDelete(addressId);
        res.redirect('/address');
    } catch (error) {
        console.log(error);
        res.redirect('/address');
    }
}

const loadEditAddress = async (req, res) => {
    try {
        const addressId = req.query.id;
        const address = await Address.findById(addressId);
        res.render('user/edit-address', { address });
    } catch (error) {
        console.log(error);
        res.redirect('/address');
    }
}

const editAddress = async (req, res) => {
    try {
        const addressId = req.body.id;
        const { fullName, phone, type, addressline1, addressline2, country, city, state, pincode } = req.body;
       console.log("addressId", addressId);
        console.log("body", req.body);
        await Address.findByIdAndUpdate(addressId, {
            fullName, phone, type, addressline1, addressline2, country, city, state, pincode
        });
        res.redirect('/address');
    } catch (error) {
        console.log(error);
        res.redirect('/address');
    }
}

const setDefaultAddress = async (req, res) => {
    try {
        const addressId = req.query.id;
        const userId = req.session.user;

        await Address.updateMany({ userId }, { $set: { isDefault: false } });
        await Address.findByIdAndUpdate(addressId, { $set: { isDefault: true } });

        res.redirect('/address');
    } catch (error) {
        console.log(error);
        res.redirect('/address');
    }
}

module.exports = {
    loadAddress,
    addAddress,
    deleteAddress,
    loadEditAddress,
    editAddress,
    setDefaultAddress
}