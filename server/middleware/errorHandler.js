const errorHandler = (err, req, res, next) => {
  let error = { ...err };
  error.message = err.message;

  // Log full error in development
  if (process.env.NODE_ENV === 'development') {
    console.error('[Error Handler]', err);
  }

  // Intercept SyntaxError (e.g. malformed JSON payloads from broken POST/PUT requests)
  if (err instanceof SyntaxError && (err.status === 400 || err.statusCode === 400 || 'body' in err)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid JSON payload format.',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined,
    });
  }

  // Mongoose bad ObjectId / CastError (Phase 12: Return 400 Bad Request for malformed ID format)
  if (err.name === 'CastError') {
    const message = `Invalid resource ID format: '${err.value}'. Must be a valid 24-character hexadecimal string.`;
    return res.status(400).json({
      success: false,
      message,
      error: process.env.NODE_ENV === 'development' ? err.message : undefined,
    });
  }

  // Mongoose duplicate key error (code 11000)
  if (err.code === 11000) {
    const field = err.keyValue ? Object.keys(err.keyValue)[0] : 'field';
    const message = `Duplicate value entered for '${field}'. A user with this ${field} already exists.`;
    return res.status(400).json({
      success: false,
      message,
      error: process.env.NODE_ENV === 'development' ? err.message : undefined,
    });
  }

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    const messages = Object.values(err.errors).map((val) => val.message);
    return res.status(400).json({
      success: false,
      message: messages.join(', '),
      errors: messages,
      error: process.env.NODE_ENV === 'development' ? err.message : undefined,
    });
  }

  // JSON Web Token Error
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({
      success: false,
      message: 'Invalid authorization token',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined,
    });
  }

  // JWT Expired Error
  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({
      success: false,
      message: 'Authorization token expired',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined,
    });
  }

  // Multer file upload errors
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({
      success: false,
      message: 'File size exceeds the permitted limit (maximum 10MB)',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined,
    });
  }

  if (err.code === 'INVALID_FILE_TYPE' || err.code === 'INVALID_MIME_TYPE') {
    return res.status(400).json({
      success: false,
      message: err.message,
      error: process.env.NODE_ENV === 'development' ? err.message : undefined,
    });
  }

  // Default server error (Standardized contract without stack trace leakage)
  const statusCode = error.statusCode || err.status || 500;
  res.status(statusCode).json({
    success: false,
    message: error.message || 'Internal Server Error',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined,
  });
};

module.exports = errorHandler;
