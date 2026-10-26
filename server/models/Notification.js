const mongoose = require('mongoose');

const NOTIFICATION_TYPES = [
  'TICKET_CREATED',
  'TICKET_ASSIGNED',
  'TICKET_STATUS_CHANGED',
  'TICKET_PRIORITY_CHANGED',
  'TICKET_COMMENT',
  'TICKET_ATTACHMENT',
  'TICKET_REOPENED',
  'SLA_WARNING',
  'SLA_BREACH',
];

const NotificationSchema = new mongoose.Schema(
  {
    recipient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Notification must have a recipient'],
      index: true,
    },
    type: {
      type: String,
      required: [true, 'Notification must have a type'],
      enum: {
        values: NOTIFICATION_TYPES,
        message: '{VALUE} is not a recognized notification type',
      },
    },
    title: {
      type: String,
      required: [true, 'Notification title is required'],
      trim: true,
      maxlength: [100, 'Title cannot exceed 100 characters'],
    },
    message: {
      type: String,
      required: [true, 'Notification message is required'],
      trim: true,
      maxlength: [500, 'Message cannot exceed 500 characters'],
    },
    ticket: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Ticket',
      default: null,
      index: true,
    },
    isRead: {
      type: Boolean,
      default: false,
      index: true,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: false,
  }
);

// Compound index for querying user notifications efficiently
NotificationSchema.index({ recipient: 1, isRead: 1, createdAt: -1 });

module.exports = mongoose.model('Notification', NotificationSchema);
module.exports.NOTIFICATION_TYPES = NOTIFICATION_TYPES;
