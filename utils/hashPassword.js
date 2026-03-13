const bcrypt = require("bcrypt");

const hashPassword = async (password) => {
  const passwordHash = await bcrypt.hash(password, 10);
  return passwordHash;
};

module.exports = hashPassword;