const userRepository = require("../../repositories/user");

const loadcat = async (req, res) => {
  try {
    const userId = req.session.user;
    if (!userId) return res.redirect("/login");

    const userData = await userRepository.findById(userId);
    if (!userData) return res.redirect("/login");

    // ✅ ONLY RENDER PAGE (NO PRODUCTS)
res.render("user/category", {
    products: []
});
  } catch (error) {
    console.error("Error loading category page:", error);
    return res.redirect("/errorPage");
  }
};

module.exports = { loadcat };