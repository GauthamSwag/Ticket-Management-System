const User = require('../models/User');
const generateToken = require('../utils/generateToken');

// @desc    Register a new user
// @route   POST /api/auth/register
// @access  Public
const register = async (req, res, next) => {
  try {
    const { name, email, password, role, department, phone } = req.body;

    // Validation
    if (!name || !email || !password || typeof name !== 'string' || typeof email !== 'string' || typeof password !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'Please provide name, email, and password',
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters long',
      });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'A user with this email address already exists',
      });
    }

    // Allowed roles
    const validRoles = ['user', 'agent', 'admin'];
    const assignedRole = role && validRoles.includes(role) ? role : 'user';

    // Create user
    const user = await User.create({
      name,
      email: email.toLowerCase(),
      password,
      role: assignedRole,
      department: department || 'General',
      phone: phone || '',
    });

    const token = generateToken(user);

    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      token,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        department: user.department,
        avatar: user.avatar,
        createdAt: user.createdAt,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Authenticate user & get token (Login)
// @route   POST /api/auth/login
// @access  Public
const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    // Validation
    if (!email || !password || typeof email !== 'string' || typeof password !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'Please provide both email and password',
      });
    }

    // Find user with password included
    const user = await User.findOne({ email: email.toLowerCase() }).select('+password');

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password',
      });
    }

    // Check if account is active
    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        message: 'Your account has been deactivated. Please contact an administrator.',
      });
    }

    // Match password
    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password',
      });
    }

    // Update last login
    user.lastLogin = Date.now();
    await user.save({ validateBeforeSave: false });

    const token = generateToken(user);

    res.status(200).json({
      success: true,
      message: 'Logged in successfully',
      token,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        department: user.department,
        avatar: user.avatar,
        lastLogin: user.lastLogin,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get currently logged-in user profile
// @route   GET /api/auth/me
// @access  Private (All authenticated roles)
const getMe = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    res.status(200).json({
      success: true,
      user,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update user profile
// @route   PUT /api/auth/profile
// @access  Private (All authenticated roles)
const updateProfile = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id).select('+password');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    const { name, phone, department, currentPassword, newPassword, notificationPreferences } = req.body;

    if (name) user.name = name;
    if (phone !== undefined) user.phone = phone;
    if (department) user.department = department;

    // Update notification preferences if provided
    if (notificationPreferences && typeof notificationPreferences === 'object') {
      user.notificationPreferences = {
        emailEnabled: notificationPreferences.emailEnabled !== undefined ? Boolean(notificationPreferences.emailEnabled) : user.notificationPreferences?.emailEnabled ?? true,
        assignmentEmails: notificationPreferences.assignmentEmails !== undefined ? Boolean(notificationPreferences.assignmentEmails) : user.notificationPreferences?.assignmentEmails ?? true,
        statusChangeEmails: notificationPreferences.statusChangeEmails !== undefined ? Boolean(notificationPreferences.statusChangeEmails) : user.notificationPreferences?.statusChangeEmails ?? true,
        slaEmails: notificationPreferences.slaEmails !== undefined ? Boolean(notificationPreferences.slaEmails) : user.notificationPreferences?.slaEmails ?? true,
      };
    }

    // Handle password change
    if (newPassword) {
      if (!currentPassword) {
        return res.status(400).json({
          success: false,
          message: 'Current password is required to change your password',
        });
      }

      const isMatch = await user.matchPassword(currentPassword);
      if (!isMatch) {
        return res.status(400).json({
          success: false,
          message: 'Current password does not match',
        });
      }

      if (newPassword.length < 6) {
        return res.status(400).json({
          success: false,
          message: 'New password must be at least 6 characters',
        });
      }

      user.password = newPassword;
    }

    await user.save();

    res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        department: user.department,
        phone: user.phone,
        avatar: user.avatar,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get all users (Admin only, supports search, filter, sorting & pagination)
// @route   GET /api/auth/users
// @access  Private (Admin role only)
const getAllUsers = async (req, res, next) => {
  try {
    const filter = {};

    // 1. Text Search (Name, Email, Department) with regex escaping
    if (req.query.search && typeof req.query.search === 'string') {
      const sanitized = req.query.search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      if (sanitized) {
        const searchRegex = new RegExp(sanitized, 'i');
        filter.$or = [
          { name: searchRegex },
          { email: searchRegex },
          { department: searchRegex },
        ];
      }
    }

    // 2. Role Filter
    if (req.query.role) {
      const validRoles = ['user', 'agent', 'admin'];
      if (validRoles.includes(req.query.role)) {
        filter.role = req.query.role;
      }
    }

    // 3. Status Filter (isActive)
    if (req.query.isActive !== undefined) {
      filter.isActive = req.query.isActive === 'true' || req.query.isActive === true;
    }

    // 4. Department Filter
    if (req.query.department) {
      const sanitizedDept = req.query.department.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      filter.department = new RegExp(`^${sanitizedDept}$`, 'i');
    }

    // 5. Pagination validation
    let page = 1;
    if (req.query.page !== undefined) {
      page = parseInt(req.query.page, 10);
      if (isNaN(page) || page < 1) {
        return res.status(400).json({
          success: false,
          message: 'Page parameter must be a positive integer greater than or equal to 1',
        });
      }
    }

    let limit = 10;
    if (req.query.limit !== undefined) {
      limit = parseInt(req.query.limit, 10);
      if (isNaN(limit) || limit < 1 || limit > 100) {
        return res.status(400).json({
          success: false,
          message: 'Limit parameter must be an integer between 1 and 100',
        });
      }
    } else if (req.query.page === undefined) {
      // Default to 50 if neither page nor limit specified, ensuring unpaginated dropdown lookups receive all accounts
      limit = 50;
    }

    // 6. Sorting
    let sortOption = { createdAt: -1 };
    if (req.query.sort) {
      switch (req.query.sort) {
        case 'oldest':
          sortOption = { createdAt: 1 };
          break;
        case 'name_asc':
          sortOption = { name: 1 };
          break;
        case 'name_desc':
          sortOption = { name: -1 };
          break;
        case 'email_asc':
          sortOption = { email: 1 };
          break;
        case 'role':
          sortOption = { role: 1 };
          break;
        case 'newest':
        default:
          sortOption = { createdAt: -1 };
          break;
      }
    }

    const totalUsers = await User.countDocuments(filter);
    const totalPages = Math.ceil(totalUsers / limit) || 1;
    const skip = (page - 1) * limit;

    const users = await User.find(filter)
      .select('-password')
      .sort(sortOption)
      .skip(skip)
      .limit(limit);

    res.status(200).json({
      success: true,
      count: users.length,
      total: totalUsers,
      pagination: {
        totalItems: totalUsers,
        totalPages,
        currentPage: page,
        page,
        limit,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1,
      },
      users,
      data: users,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update user role
// @route   PUT /api/auth/users/:id/role
// @access  Private (Admin only)
const updateUserRole = async (req, res, next) => {
  try {
    const { role } = req.body;
    const validRoles = ['user', 'agent', 'admin'];

    if (!role || !validRoles.includes(role)) {
      return res.status(400).json({
        success: false,
        message: `Invalid role. Valid roles: ${validRoles.join(', ')}`,
      });
    }

    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    // Safety: prevent admin from demoting their own account
    if (req.user._id.toString() === user._id.toString() && role !== 'admin') {
      return res.status(400).json({
        success: false,
        message: 'Administrators cannot demote their own account',
      });
    }

    user.role = role;
    await user.save();

    res.status(200).json({
      success: true,
      message: `User role updated to ${role} successfully`,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        department: user.department,
        isActive: user.isActive,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Toggle/Update user active status
// @route   PUT /api/auth/users/:id/status
// @access  Private (Admin only)
const toggleUserStatus = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    let newStatus;
    if (req.body && req.body.isActive !== undefined) {
      newStatus = typeof req.body.isActive === 'boolean'
        ? req.body.isActive
        : req.body.isActive === 'true' || req.body.isActive === true;
    } else {
      // Toggle if not explicitly specified
      newStatus = !user.isActive;
    }

    // Safety: prevent admin from deactivating their own account
    if (req.user._id.toString() === user._id.toString() && !newStatus) {
      return res.status(400).json({
        success: false,
        message: 'Administrators cannot deactivate their own account',
      });
    }

    user.isActive = newStatus;
    await user.save();

    res.status(200).json({
      success: true,
      message: `User account ${newStatus ? 'activated' : 'deactivated'} successfully`,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        department: user.department,
        isActive: user.isActive,
      },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  register,
  login,
  getMe,
  updateProfile,
  getAllUsers,
  updateUserRole,
  toggleUserStatus,
};
