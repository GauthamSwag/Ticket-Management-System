const Notification = require('../models/Notification');

// @desc    Get current user notifications (paginated, sorted by newest)
// @route   GET /api/notifications
// @access  Private
const getNotifications = async (req, res, next) => {
  try {
    const filter = { recipient: req.user.id };

    if (req.query.isRead !== undefined) {
      filter.isRead = req.query.isRead === 'true' || req.query.isRead === true;
    }

    if (req.query.type) {
      filter.type = req.query.type;
    }

    // Pagination validation
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

    let limit = 50;
    if (req.query.limit !== undefined) {
      limit = parseInt(req.query.limit, 10);
      if (isNaN(limit) || limit < 1 || limit > 100) {
        return res.status(400).json({
          success: false,
          message: 'Limit parameter must be an integer between 1 and 100',
        });
      }
    } else if (req.query.page !== undefined) {
      limit = 10;
    }

    const totalItems = await Notification.countDocuments(filter);
    const totalPages = Math.ceil(totalItems / limit) || 1;
    const skip = (page - 1) * limit;

    const notifications = await Notification.find(filter)
      .populate('ticket', 'ticketId title status priority')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const unreadCount = await Notification.countDocuments({
      recipient: req.user.id,
      isRead: false,
    });

    res.status(200).json({
      success: true,
      count: notifications.length,
      total: totalItems,
      unreadCount,
      pagination: {
        totalItems,
        totalPages,
        currentPage: page,
        page,
        limit,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1,
      },
      notifications,
      data: notifications,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get unread notification count
// @route   GET /api/notifications/unread-count
// @access  Private
const getUnreadCount = async (req, res, next) => {
  try {
    const count = await Notification.countDocuments({
      recipient: req.user.id,
      isRead: false,
    });

    res.status(200).json({
      success: true,
      count,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Mark single notification as read
// @route   PUT /api/notifications/:id/read
// @access  Private
const markAsRead = async (req, res, next) => {
  try {
    const notification = await Notification.findById(req.params.id);

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found',
      });
    }

    if (notification.recipient.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to modify this notification',
      });
    }

    notification.isRead = true;
    await notification.save();

    res.status(200).json({
      success: true,
      notification,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Mark all user notifications as read
// @route   PUT /api/notifications/read-all
// @access  Private
const markAllAsRead = async (req, res, next) => {
  try {
    const result = await Notification.updateMany(
      { recipient: req.user.id, isRead: false },
      { $set: { isRead: true } }
    );

    res.status(200).json({
      success: true,
      message: 'All notifications marked as read',
      modifiedCount: result.modifiedCount,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete single notification
// @route   DELETE /api/notifications/:id
// @access  Private
const deleteNotification = async (req, res, next) => {
  try {
    const notification = await Notification.findById(req.params.id);

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found',
      });
    }

    if (notification.recipient.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to delete this notification',
      });
    }

    await notification.deleteOne();

    res.status(200).json({
      success: true,
      message: 'Notification deleted successfully',
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  deleteNotification,
};
