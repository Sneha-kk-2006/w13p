const mongoose = require('mongoose');
const User = require('./models/userSchema');
require('dotenv').config();

const update = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('DB connected');

    const res = await User.updateOne(
      { email: 'admin@gmail.com' },
      { $set: { role: 'admin' } }
    );
    console.log('Update result:', res);

    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

update();
