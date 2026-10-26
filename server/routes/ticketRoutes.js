const express = require('express');
const router = express.Router();
const {
  createTicket,
  getTickets,
  getTicketById,
  updateTicket,
  deleteTicket,
  assignTicket,
  updateTicketStatus,
  updateTicketPriority,
  classifyTicketEndpoint,
} = require('../controllers/ticketController');
const {
  createComment,
  getComments,
  deleteComment,
} = require('../controllers/commentController');
const { getTicketHistory } = require('../controllers/ticketHistoryController');
const {
  uploadAttachment,
  getAttachments,
  downloadAttachment,
  deleteAttachment,
} = require('../controllers/attachmentController');
const { protect, authorize } = require('../middleware/auth');
const { upload } = require('../middleware/upload');

// All ticket routes require authentication
router.use(protect);

// -------------------------------------------------------------
// Core Ticket Collection & Specific Instance Routes
// -------------------------------------------------------------
router.route('/')
  .post(createTicket)
  .get(getTickets);

router.route('/:id')
  .get(getTicketById)
  .put(updateTicket)
  .delete(deleteTicket);

// Admin-only ticket assignment
router.put('/:id/assign', authorize('admin'), assignTicket);

// Status and priority adjustments (Agent assigned or Admin)
router.put('/:id/status', authorize('agent', 'admin'), updateTicketStatus);
router.put('/:id/priority', authorize('agent', 'admin'), updateTicketPriority);

// AI-assisted ticket classification suggestion (Creator, Assigned Agent, Admin)
router.post('/:id/classify', classifyTicketEndpoint);

// -------------------------------------------------------------
// Phase 3 Sub-Resource Routes: Comments, History, Attachments
// -------------------------------------------------------------

// Comments API
router.route('/:ticketId/comments')
  .post(createComment)
  .get(getComments);

router.delete('/:ticketId/comments/:commentId', deleteComment);

// Audit History API
router.get('/:ticketId/history', getTicketHistory);

// Attachments API
router.route('/:ticketId/attachments')
  .post(upload.single('file'), uploadAttachment)
  .get(getAttachments);

router.route('/:ticketId/attachments/:attachmentId')
  .get(downloadAttachment)
  .delete(deleteAttachment);

module.exports = router;
