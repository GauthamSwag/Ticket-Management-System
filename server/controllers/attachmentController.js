const path = require('path');
const fs = require('fs');
const Attachment = require('../models/Attachment');
const { findTicket, checkTicketAccess } = require('./commentController');
const logTicketHistory = require('../utils/historyLogger');
const { emitToTicket } = require('../socket');
const { sendNotification } = require('../utils/notificationService');

// @desc    Upload an attachment to a ticket
// @route   POST /api/tickets/:ticketId/attachments
// @access  Private (Creator, Assigned Agent, Admin)
const uploadAttachment = async (req, res, next) => {
  try {
    const ticket = await findTicket(req.params.ticketId);

    if (!ticket) {
      // Clean up uploaded file if ticket not found
      if (req.file && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
      return res.status(404).json({
        success: false,
        message: 'Ticket not found',
      });
    }

    // Authorization check
    if (!checkTicketAccess(ticket, req.user)) {
      if (req.file && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to upload attachments to this ticket',
      });
    }

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'Please select a file to upload',
      });
    }

    const attachment = await Attachment.create({
      ticket: ticket._id,
      uploadedBy: req.user.id,
      originalName: req.file.originalname,
      storedName: req.file.filename,
      mimeType: req.file.mimetype,
      size: req.file.size,
      filePath: req.file.path,
    });

    const populatedAttachment = await Attachment.findById(attachment._id).populate(
      'uploadedBy',
      'name email role department'
    );

    // Record audit history
    await logTicketHistory(
      ticket._id,
      req.user.id,
      'ATTACHMENT_ADDED',
      `${req.user.name} (${req.user.role}) uploaded file: ${req.file.originalname}`,
      null,
      { fileName: req.file.originalname, size: req.file.size }
    );

    // Real-time socket emissions
    emitToTicket(ticket._id, 'attachment:added', populatedAttachment);
    emitToTicket(ticket._id, 'ticket:historyUpdated', {
      action: 'ATTACHMENT_ADDED',
      ticketId: ticket.ticketId,
    });

    // Send notifications to relevant participants
    // 1. If User uploaded and ticket is assigned, notify Agent
    if (
      req.user.role === 'user' &&
      ticket.assignedTo &&
      ticket.assignedTo.toString() !== req.user.id
    ) {
      await sendNotification({
        recipient: ticket.assignedTo,
        type: 'TICKET_ATTACHMENT',
        title: `New Attachment on Ticket ${ticket.ticketId}`,
        message: `${req.user.name} attached file: ${req.file.originalname}`,
        ticket: ticket._id,
      });
    }

    // 2. If Agent or Admin uploaded, notify Ticket Creator (if not uploader)
    if (
      (req.user.role === 'agent' || req.user.role === 'admin') &&
      ticket.createdBy &&
      ticket.createdBy.toString() !== req.user.id
    ) {
      await sendNotification({
        recipient: ticket.createdBy,
        type: 'TICKET_ATTACHMENT',
        title: `File Attached to Ticket ${ticket.ticketId}`,
        message: `${req.user.name} (${req.user.role}) attached file: ${req.file.originalname}`,
        ticket: ticket._id,
      });
    }

    res.status(201).json({
      success: true,
      message: 'File uploaded successfully',
      attachment: populatedAttachment,
    });
  } catch (error) {
    // Ensure uploaded file is removed on error
    if (req.file && fs.existsSync(req.file.path)) {
      try {
        fs.unlinkSync(req.file.path);
      } catch (cleanupErr) {
        console.error('Failed to cleanup file:', cleanupErr.message);
      }
    }
    next(error);
  }
};

// @desc    List all attachments for a ticket
// @route   GET /api/tickets/:ticketId/attachments
// @access  Private (Creator, Assigned Agent, Admin)
const getAttachments = async (req, res, next) => {
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
        message: 'You are not authorized to view attachments for this ticket',
      });
    }

    const attachments = await Attachment.find({ ticket: ticket._id })
      .populate('uploadedBy', 'name email role department')
      .sort({ createdAt: 1 });

    res.status(200).json({
      success: true,
      count: attachments.length,
      attachments,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Download / stream attachment safely
// @route   GET /api/tickets/:ticketId/attachments/:attachmentId
// @access  Private (Creator, Assigned Agent, Admin)
const downloadAttachment = async (req, res, next) => {
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
        message: 'You are not authorized to access attachments from this ticket',
      });
    }

    const attachment = await Attachment.findById(req.params.attachmentId);

    if (!attachment) {
      return res.status(404).json({
        success: false,
        message: 'Attachment not found',
      });
    }

    // Verify attachment belongs to this ticket
    if (attachment.ticket.toString() !== ticket._id.toString()) {
      return res.status(400).json({
        success: false,
        message: 'Attachment does not belong to the requested ticket',
      });
    }

    // Verify physical file exists on disk
    if (!fs.existsSync(attachment.filePath)) {
      return res.status(404).json({
        success: false,
        message: 'Attachment file not found on server disk',
      });
    }

    // Set appropriate content type and download header
    res.download(attachment.filePath, attachment.originalName);
  } catch (error) {
    next(error);
  }
};

// @desc    Delete an attachment
// @route   DELETE /api/tickets/:ticketId/attachments/:attachmentId
// @access  Private (Uploader or Admin)
const deleteAttachment = async (req, res, next) => {
  try {
    const ticket = await findTicket(req.params.ticketId);

    if (!ticket) {
      return res.status(404).json({
        success: false,
        message: 'Ticket not found',
      });
    }

    const attachment = await Attachment.findById(req.params.attachmentId);

    if (!attachment) {
      return res.status(404).json({
        success: false,
        message: 'Attachment not found',
      });
    }

    // Verify attachment belongs to this ticket
    if (attachment.ticket.toString() !== ticket._id.toString()) {
      return res.status(400).json({
        success: false,
        message: 'Attachment does not belong to the requested ticket',
      });
    }

    // Authorization check: Uploader or Admin
    const isUploader = attachment.uploadedBy.toString() === req.user.id.toString();
    const isAdmin = req.user.role === 'admin';

    if (!isUploader && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to delete another user’s attachment',
      });
    }

    // Physical file deletion from disk
    if (fs.existsSync(attachment.filePath)) {
      try {
        await fs.promises.unlink(attachment.filePath);
      } catch (unlinkErr) {
        console.error('Error unlinking physical file:', unlinkErr.message);
        return res.status(500).json({
          success: false,
          message: 'Failed to safely remove physical file from server storage',
        });
      }
    }

    await Attachment.deleteOne({ _id: attachment._id });

    // Record audit history
    await logTicketHistory(
      ticket._id,
      req.user.id,
      'ATTACHMENT_DELETED',
      `${req.user.name} (${req.user.role}) deleted attachment: ${attachment.originalName}`
    );

    // Real-time socket emissions
    emitToTicket(ticket._id, 'attachment:deleted', { attachmentId: attachment._id });
    emitToTicket(ticket._id, 'ticket:historyUpdated', {
      action: 'ATTACHMENT_DELETED',
      ticketId: ticket.ticketId,
    });

    res.status(200).json({
      success: true,
      message: 'Attachment deleted successfully',
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  uploadAttachment,
  getAttachments,
  downloadAttachment,
  deleteAttachment,
};
