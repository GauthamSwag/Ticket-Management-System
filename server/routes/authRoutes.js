const express = require('express');
const router = express.Router();
const {
  register,
  login,
  getMe,
  updateProfile,
  getAllUsers,
  updateUserRole,
  toggleUserStatus,
} = require('../controllers/authController');
const { protect, authorize } = require('../middleware/auth');

// Public routes
router.post('/register', register);
router.post('/login', login);

// Private authenticated routes (All roles)
router.get('/me', protect, getMe);
router.put('/profile', protect, updateProfile);

// Admin-only routes
router.get('/users', protect, authorize('admin'), getAllUsers);
router.put('/users/:id/role', protect, authorize('admin'), updateUserRole);
router.put('/users/:id/status', protect, authorize('admin'), toggleUserStatus);

module.exports = router;
