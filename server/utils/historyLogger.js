const TicketHistory = require('../models/TicketHistory');

/**
 * Record an audit log entry for a ticket action
 * @param {string|ObjectId} ticketId - ID of the target ticket
 * @param {string|ObjectId} userId - ID of the user performing the action
 * @param {string} action - Enum action string
 * @param {string} description - Human-readable description of change
 * @param {*} oldValue - Optional previous value
 * @param {*} newValue - Optional updated value
 */
const logTicketHistory = async (ticketId, userId, action, description, oldValue = null, newValue = null) => {
  try {
    await TicketHistory.create({
      ticket: ticketId,
      performedBy: userId,
      action,
      description,
      oldValue,
      newValue,
    });
  } catch (err) {
    console.error(`[History Logger] Failed to record history entry for ticket ${ticketId}:`, err.message);
  }
};

module.exports = logTicketHistory;
