const mongoose = require('mongoose');
const Comment = require('../models/Comment');
const Ticket = require('../models/Ticket');
const logTicketHistory = require('../utils/historyLogger');
const { emitToTicket } = require('../socket');
const { sendNotification } = require('../utils/notificationService');

// Helper to find ticket by ObjectId or ticketId string
const findTicket = async (idParam) => {
  if (idParam && typeof idParam === 'string' && idParam.toUpperCase().startsWith('TKT-')) {
    return await Ticket.findOne({ ticketId: idParam.toUpperCase() });
  }
  return await Ticket.findById(idParam);
};

// Helper to check user permission to access a ticket
const checkTicketAccess = (ticket, user) => {
  if (user.role === 'admin') return true;
  if (user.role === 'agent') {
    return ticket.assignedTo && ticket.assignedTo.toString() === user.id.toString();
  }
  if (user.role === 'user') {
    return ticket.createdBy && ticket.createdBy.toString() === user.id.toString();
  }
  return false;
};

// @desc    Create a comment on a ticket
// @route   POST /api/tickets/:ticketId/comments
// @access  Private (Creator, Assigned Agent, Admin)
const createComment = async (req, res, next) => {
  try {
    const ticket = await findTicket(req.params.ticketId);

    if (!ticket) {
      return res.status(404).json({
        success: false,
        message: 'Ticket not found',
      });
    }

    // Authorization check
    if (!checkTicketAccess(ticket, req.user)) {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to comment on this ticket',
      });
    }

    const { message } = req.body;

    if (!message || !message.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Comment message cannot be empty',
      });
    }

    if (message.trim().length > 3000) {
      return res.status(400).json({
        success: false,
        message: 'Comment message cannot exceed 3000 characters',
      });
    }

    const comment = await Comment.create({
      ticket: ticket._id,
      user: req.user.id,
      message: message.trim(),
    });

    const populatedComment = await Comment.findById(comment._id).populate(
      'user',
      'name email role department avatar'
    );

    // Record first response timestamp if Agent or Admin responds
    if (
      (req.user.role === 'agent' || req.user.role === 'admin') &&
      ticket.sla &&
      !ticket.sla.firstRespondedAt
    ) {
      ticket.sla.firstRespondedAt = new Date();
      await ticket.save();
    }

    // Record audit history
    await logTicketHistory(
      ticket._id,
      req.user.id,
      'COMMENT_ADDED',
      `${req.user.name} (${req.user.role}) added a comment to the ticket`
    );

    // Real-time socket emissions
    emitToTicket(ticket._id, 'comment:created', populatedComment);
    emitToTicket(ticket._id, 'ticket:historyUpdated', {
      action: 'COMMENT_ADDED',
      ticketId: ticket.ticketId,
    });

    // Send notifications to relevant participants
    // 1. If User commented and ticket is assigned, notify Agent
    if (
      req.user.role === 'user' &&
      ticket.assignedTo &&
      ticket.assignedTo.toString() !== req.user.id
    ) {
      await sendNotification({
        recipient: ticket.assignedTo,
        type: 'TICKET_COMMENT',
        title: `New Comment on Ticket ${ticket.ticketId}`,
        message: `${req.user.name} commented: "${message.trim().substring(0, 80)}${message.length > 80 ? '...' : ''}"`,
        ticket: ticket._id,
      });
    }

    // 2. If Agent or Admin commented, notify Ticket Creator (if not commenter)
    if (
      (req.user.role === 'agent' || req.user.role === 'admin') &&
      ticket.createdBy &&
      ticket.createdBy.toString() !== req.user.id
    ) {
      await sendNotification({
        recipient: ticket.createdBy,
        type: 'TICKET_COMMENT',
        title: `Response on Ticket ${ticket.ticketId}`,
        message: `${req.user.name} (${req.user.role}) commented: "${message.trim().substring(0, 80)}${message.length > 80 ? '...' : ''}"`,
        ticket: ticket._id,
      });
    }

    res.status(201).json({
      success: true,
      message: 'Comment added successfully',
      comment: populatedComment,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Retrieve all comments for a ticket
// @route   GET /api/tickets/:ticketId/comments
// @access  Private (Creator, Assigned Agent, Admin)
const getComments = async (req, res, next) => {
  try {
    const ticket = await findTicket(req.params.ticketId);

    if (!ticket) {
      return res.status(404).json({
        success: false,
        message: 'Ticket not found',
      });
    }

    // Authorization check
    if (!checkTicketAccess(ticket, req.user)) {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to view comments for this ticket',
      });
    }

    const comments = await Comment.find({ ticket: ticket._id })
      .populate('user', 'name email role department avatar')
      .sort({ createdAt: 1 });

    res.status(200).json({
      success: true,
      count: comments.length,
      comments,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete a comment
// @route   DELETE /api/tickets/:ticketId/comments/:commentId
// @access  Private (Author of comment or Admin)
const deleteComment = async (req, res, next) => {
  try {
    const ticket = await findTicket(req.params.ticketId);

    if (!ticket) {
      return res.status(404).json({
        success: false,
        message: 'Ticket not found',
      });
    }

    const comment = await Comment.findById(req.params.commentId);

    if (!comment) {
      return res.status(404).json({
        success: false,
        message: 'Comment not found',
      });
    }

    // Verify comment belongs to specified ticket
    if (comment.ticket.toString() !== ticket._id.toString()) {
      return res.status(400).json({
        success: false,
        message: 'Comment does not belong to the specified ticket',
      });
    }

    // Authorization check: User/Agent can delete their own comment; Admin can delete any
    const isAuthor = comment.user.toString() === req.user.id.toString();
    const isAdmin = req.user.role === 'admin';

    if (!isAuthor && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to delete another user’s comment',
      });
    }

    await Comment.deleteOne({ _id: comment._id });

    // Record audit history
    await logTicketHistory(
      ticket._id,
      req.user.id,
      'COMMENT_DELETED',
      `${req.user.name} (${req.user.role}) removed a comment`
    );

    // Real-time socket emissions
    emitToTicket(ticket._id, 'comment:deleted', { commentId: comment._id });
    emitToTicket(ticket._id, 'ticket:historyUpdated', {
      action: 'COMMENT_DELETED',
      ticketId: ticket.ticketId,
    });

    res.status(200).json({
      success: true,
      message: 'Comment deleted successfully',
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createComment,
  getComments,
  deleteComment,
  findTicket,
  checkTicketAccess,
};
