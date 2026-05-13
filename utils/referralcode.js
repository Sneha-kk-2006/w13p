
const { v4: uuidv4 } = require('uuid');

function generateReferralCode(username) {
  const prefix = username.slice(0, 4).toUpperCase();      
  const suffix = uuidv4().replace(/-/g, '').slice(0, 5).toUpperCase(); 
  return prefix + suffix; 
}

module.exports = generateReferralCode;