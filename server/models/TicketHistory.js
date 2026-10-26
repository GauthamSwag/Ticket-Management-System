const mongoose = require('mongoose');

const ACTIONS = [
  'TICKET_CREATED',
  'TICKET_UPDATED',
  'TICKET_ASSIGNED',
  'TICKET_REASSIGNED',
  'STATUS_CHANGED',
  'PRIORITY_CHANGED',
  'COMMENT_ADDED',
  'COMMENT_DELETED',
  'ATTACHMENT_ADDED',
  'ATTACHMENT_DELETED',
  'TICKET_DELETED',
  'SLA_RESPONSE_BREACHED',
  'SLA_RESOLUTION_BREACHED',
  'SLA_CONFIGURATION_UPDATED',
  'AI_CLASSIFICATION_REQUESTED',
];

const TicketHistorySchema = new mongoose.Schema({
  ticket: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Ticket',
    required: [true, 'History entry must reference a ticket'],
  },
  performedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
  },
  action: {
    type: String,
    required: [true, 'History action is required'],
    enum: {
      values: ACTIONS,
      message: '{VALUE} is not a supported history action',
    },
  },
  description: {
    type: String,
    required: [true, 'History description is required'],
    trim: true,
  },
  oldValue: {
    type: mongoose.Schema.Types.Mixed,
    default: null,
  },
  newValue: {
    type: mongoose.Schema.Types.Mixed,
    default: null,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

TicketHistorySchema.index({ ticket: 1, createdAt: 1 });

module.exports = mongoose.model('TicketHistory', TicketHistorySchema);
module.exports.ACTIONS = ACTIONS;
