const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

// Target directory for ticket attachments
const uploadDirectory = path.join(__dirname, '..', 'uploads', 'tickets');

// Ensure upload directory exists
if (!fs.existsSync(uploadDirectory)) {
  fs.mkdirSync(uploadDirectory, { recursive: true });
}

// Configurable max file size (default: 10MB)
const maxFileSizeMB = parseInt(process.env.MAX_FILE_SIZE_MB, 10) || 10;
const maxFileSizeBytes = maxFileSizeMB * 1024 * 1024;

// Allowed file extensions
const ALLOWED_EXTENSIONS = [
  '.jpg',
  '.jpeg',
  '.png',
  '.webp',
  '.pdf',
  '.txt',
  '.doc',
  '.docx',
  '.xls',
  '.xlsx',
];

// Allowed MIME types
const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
  'text/plain',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
];

// Disk storage engine with collision-free, randomized server filenames
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDirectory);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const randomHash = crypto.randomBytes(16).toString('hex');
    const secureFileName = `${Date.now()}-${randomHash}${ext}`;
    cb(null, secureFileName);
  },
});

// File filter function verifying extension and MIME type
const fileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();

  // Check extension
  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    const error = new Error(
      `File type '${ext}' is not permitted. Allowed formats: images (jpg, png, webp), documents (pdf, txt, doc, docx), spreadsheets (xls, xlsx).`
    );
    error.code = 'INVALID_FILE_TYPE';
    return cb(error, false);
  }

  // Check MIME type
  if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    const error = new Error(`MIME type '${file.mimetype}' is not permitted for upload.`);
    error.code = 'INVALID_MIME_TYPE';
    return cb(error, false);
  }

  cb(null, true);
};

const upload = multer({
  storage,
  limits: {
    fileSize: maxFileSizeBytes,
  },
  fileFilter,
});

module.exports = {
  upload,
  uploadDirectory,
  maxFileSizeMB,
  ALLOWED_EXTENSIONS,
};
