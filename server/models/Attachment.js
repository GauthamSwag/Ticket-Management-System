const mongoose = require('mongoose');

const AttachmentSchema = new mongoose.Schema({
  ticket: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Ticket',
    required: [true, 'Attachment must be associated with a ticket'],
  },
  uploadedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Attachment must record the uploader'],
  },
  originalName: {
    type: String,
    required: [true, 'Original file name is required'],
    trim: true,
  },
  storedName: {
    type: String,
    required: [true, 'Server-side stored file name is required'],
    trim: true,
  },
  mimeType: {
    type: String,
    required: [true, 'MIME type is required'],
    trim: true,
  },
  size: {
    type: Number,
    required: [true, 'File size in bytes is required'],
  },
  filePath: {
    type: String,
    required: [true, 'File path is required'],
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

AttachmentSchema.index({ ticket: 1, createdAt: 1 });

module.exports = mongoose.model('Attachment', AttachmentSchema);
