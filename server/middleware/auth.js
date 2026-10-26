const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Protect routes: verify JWT in Authorization header
const protect = async (req, res, next) => {
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    try {
      token = req.headers.authorization.split(' ')[1];

      // Verify token
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      // Fetch user without password
      const user = await User.findById(decoded.id).select('-password');

      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'Not authorized, user account no longer exists',
        });
      }

      if (!user.isActive) {
        return res.status(403).json({
          success: false,
          message: 'Account is deactivated. Please contact an administrator.',
        });
      }

      req.user = user;
      next();
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        return res.status(401).json({
          success: false,
          message: 'Not authorized, token has expired',
          error: 'TokenExpiredError',
        });
      }
      if (error.name === 'JsonWebTokenError') {
        return res.status(401).json({
          success: false,
          message: 'Not authorized, invalid or tampered token',
          error: 'JsonWebTokenError',
        });
      }
      console.error('[Auth Middleware] Authentication error:', error.message);
      return res.status(401).json({
        success: false,
        message: 'Not authorized, authentication failed',
        error: error.name || 'AuthenticationError',
      });
    }
  } else {
    return res.status(401).json({
      success: false,
      message: 'Not authorized, no authorization token provided',
    });
  }
};

// Grant access to specific roles (RBAC)
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'User authentication required',
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Forbidden: Role '${req.user.role}' is not authorized to access this resource`,
      });
    }

    next();
  };
};

module.exports = { protect, authorize };
