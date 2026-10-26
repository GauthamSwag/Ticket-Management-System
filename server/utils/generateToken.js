const jwt = require('jsonwebtoken');

const generateToken = (user) => {
  return jwt.sign(
    {
      id: user._id,
      role: user.role,
      name: user.name,
      email: user.email,
    },
    process.env.JWT_SECRET,
    {
      expiresIn: process.env.JWT_EXPIRE || '30d',
    }
  );
};

module.exports = generateToken;
