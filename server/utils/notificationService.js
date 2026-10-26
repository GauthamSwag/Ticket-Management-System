const Notification = require('../models/Notification');
const { emitToUser } = require('../socket');

const sendNotification = async ({ recipient, type, title, message, ticket = null }) => {
  try {
    if (!recipient || !type || !title || !message) {
      return null;
    }

    const notification = await Notification.create({
      recipient,
      type,
      title,
      message,
      ticket: ticket ? ticket._id || ticket : null,
      isRead: false,
    });

    // Populate ticket info if available
    const populated = await Notification.findById(notification._id).populate(
      'ticket',
      'ticketId title status priority'
    );

    // Emit live event to user room via Socket.IO
    emitToUser(recipient, 'notification:new', populated);

    return populated;
  } catch (err) {
    console.error('[NotificationService] Failed to send notification:', err.message);
    return null;
  }
};

module.exports = {
  sendNotification,
};
