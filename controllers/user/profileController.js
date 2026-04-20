const userRepository = require("../../repositories/user");
const profileService = require("../../services/user/profileService");
const { changeUserPassword } = require("../../services/user/profileService");


const loadprofile = async (req, res) => {
  try {
    const userId = req.session.user;
    if (!userId) return res.redirect("/login");

    const userData = await userRepository.findById(userId);
    if (!userData) return res.redirect("/login");
     
    

    res.render("user/profile", { user: userData });
  } catch (error) {
    console.error("Error loading profile:", error);
    res.redirect("/errorPage");
  }
};


const updateProfile = async (req, res) => {
  try {
    const result = await profileService.updateProfileService(req);

    if (!result.success) {
    
      return res.status(400).json({ success: false, message: result.message });
    }
     const updatedUser = await userRepository.findById(req.session.user);
    req.session.user = updatedUser; 
    
    return res.redirect(result.redirect);
  } catch (error) {
    console.error("Error updating profile:", error);
    return res.redirect("/profile");
  }
};


const loadChangePassword = async (req, res) => {
  try {
    res.render("user/changePassword", { success: false, error: null });
  } catch (error) {
    console.error("Error loading change password page:", error);
    res.redirect("/profile");
  }
};

const changePassword = async (req, res) => {
  try {
    const userId = req.session.user;
    if (!userId) return res.status(401).json({ success: false, message: "Unauthorized" });

    const { currentPassword, newPassword, confirmPassword } = req.body;

    const result = await changeUserPassword(userId, currentPassword, newPassword, confirmPassword);

    if (!result.success) return res.status(400).json(result);


    req.session.destroy((err) => {
      if (err) console.error("Session destroy error:", err);
    });

    return res.json({ success: true, message: result.message });
  } catch (error) {
    console.error("Change password error:", error);
    return res.status(500).json({ success: false, message: "Something went wrong" });
  }
};

const logout = async (req, res) => {
  try {
    req.session.destroy((err) => {
      if (err) {
        console.error("Logout error:", err);
      }
      res.redirect("/login");
    });
  } catch (error) {
    console.error("Error during logout:", error);
    res.redirect("/profile");
  }
};

module.exports = {
  loadprofile,
  updateProfile,
  loadChangePassword,
  changePassword,
  logout,
};