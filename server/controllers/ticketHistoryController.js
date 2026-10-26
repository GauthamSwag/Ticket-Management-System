const TicketHistory = require('../models/TicketHistory');
const { findTicket, checkTicketAccess } = require('./commentController');

// @desc    Retrieve audit history timeline for a ticket
// @route   GET /api/tickets/:ticketId/history
// @access  Private (Creator, Assigned Agent, Admin)
const getTicketHistory = async (req, res, next) => {
  try {
    const ticket = await findTicket(req.params.ticketId);

    if (!ticket) {
      return res.status(404).json({
        success: false,
        message: 'Ticket not found',
      });
    }

    // Verify user has access to view this ticket
    if (!checkTicketAccess(ticket, req.user)) {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to view the activity history for this ticket',
      });
    }

    const history = await TicketHistory.find({ ticket: ticket._id })
      .populate('performedBy', 'name email role department avatar')
      .sort({ createdAt: 1 });

    res.status(200).json({
      success: true,
      count: history.length,
      history,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getTicketHistory,
};
