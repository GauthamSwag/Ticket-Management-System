const mongoose = require('mongoose');
const Counter = require('./Counter');

const CATEGORIES = [
  'Technical Issue',
  'Account Issue',
  'Billing',
  'Software',
  'Hardware',
  'Network',
  'Other',
];

const PRIORITIES = ['Low', 'Medium', 'High', 'Critical'];

const STATUSES = ['Open', 'Assigned', 'In Progress', 'Resolved', 'Closed'];

const TicketSchema = new mongoose.Schema(
  {
    ticketId: {
      type: String,
      unique: true,
      trim: true,
      uppercase: true,
    },
    title: {
      type: String,
      required: [true, 'Please provide a ticket title'],
      trim: true,
      maxlength: [150, 'Title cannot exceed 150 characters'],
    },
    description: {
      type: String,
      required: [true, 'Please provide a ticket description'],
      trim: true,
      maxlength: [5000, 'Description cannot exceed 5000 characters'],
    },
    category: {
      type: String,
      required: [true, 'Please specify a category'],
      enum: {
        values: CATEGORIES,
        message: '{VALUE} is not a supported category',
      },
      default: 'Technical Issue',
    },
    priority: {
      type: String,
      required: [true, 'Please specify a priority'],
      enum: {
        values: PRIORITIES,
        message: '{VALUE} is not a supported priority',
      },
      default: 'Medium',
    },
    status: {
      type: String,
      required: true,
      enum: {
        values: STATUSES,
        message: '{VALUE} is not a valid status',
      },
      default: 'Open',
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Ticket must have a creator'],
    },
    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    resolvedAt: {
      type: Date,
      default: null,
    },
    closedAt: {
      type: Date,
      default: null,
    },
    sla: {
      responseDueAt: {
        type: Date,
        default: null,
      },
      resolutionDueAt: {
        type: Date,
        default: null,
      },
      responseBreached: {
        type: Boolean,
        default: false,
      },
      resolutionBreached: {
        type: Boolean,
        default: false,
      },
      firstRespondedAt: {
        type: Date,
        default: null,
      },
      approachingWarningSent: {
        type: Boolean,
        default: false,
      },
      responseBreachSent: {
        type: Boolean,
        default: false,
      },
      resolutionBreachSent: {
        type: Boolean,
        default: false,
      },
    },
  },
  {
    timestamps: true,
  }
);

// Atomic human-readable ticketId generation prior to validation
TicketSchema.pre('validate', async function (next) {
  if (!this.ticketId) {
    try {
      const counter = await Counter.findOneAndUpdate(
        { id: 'ticketId' },
        { $inc: { seq: 1 } },
        { new: true, upsert: true }
      );
      const seqNumber = String(counter.seq).padStart(6, '0');
      this.ticketId = `TKT-${seqNumber}`;
    } catch (err) {
      return next(err);
    }
  }
  next();
});

// Indexes for high-performance searching and filtering
TicketSchema.index({ status: 1 });
TicketSchema.index({ priority: 1 });
TicketSchema.index({ category: 1 });
TicketSchema.index({ createdBy: 1 });
TicketSchema.index({ assignedTo: 1 });
TicketSchema.index({ createdAt: -1 });
TicketSchema.index({ 'sla.responseBreached': 1 });
TicketSchema.index({ 'sla.resolutionBreached': 1 });
TicketSchema.index({ 'sla.responseDueAt': 1 });
TicketSchema.index({ 'sla.resolutionDueAt': 1 });

module.exports = mongoose.model('Ticket', TicketSchema);
module.exports.CATEGORIES = CATEGORIES;
module.exports.PRIORITIES = PRIORITIES;
module.exports.STATUSES = STATUSES;
