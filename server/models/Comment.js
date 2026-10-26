const mongoose = require('mongoose');

const CommentSchema = new mongoose.Schema(
  {
    ticket: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Ticket',
      required: [true, 'Comment must be associated with a ticket'],
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Comment must have an author'],
    },
    message: {
      type: String,
      required: [true, 'Please provide comment text'],
      trim: true,
      maxlength: [3000, 'Comment cannot exceed 3000 characters'],
    },
  },
  {
    timestamps: true,
  }
);

// Index for chronological retrieval per ticket
CommentSchema.index({ ticket: 1, createdAt: 1 });

module.exports = mongoose.model('Comment', CommentSchema);
