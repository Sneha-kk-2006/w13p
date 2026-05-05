
const loadCoupons = async(req,res)=>{
    try{
        const coupons = await couponService.getAllCoupons();
        res.render('user/coupons', { coupons });
    }catch(error){
        console.error('Error loading coupons:', error);
        res.status(500).render('user/errorPage', { message: 'Failed to load coupons' });
    }
}