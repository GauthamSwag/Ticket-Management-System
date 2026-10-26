const express = require('express');
const http = require('http');
const cors = require('cors');
const morgan = require('morgan');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables
dotenv.config();

const { connectDB } = require('./config/db');
const errorHandler = require('./middleware/errorHandler');
const { initSocket } = require('./socket');

// Route files
const authRoutes = require('./routes/authRoutes');
const ticketRoutes = require('./routes/ticketRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const analyticsRoutes = require('./routes/analyticsRoutes');
const slaRoutes = require('./routes/slaRoutes');
const { initSLAMonitor } = require('./utils/slaMonitor');
const { seedDefaultsIfEmpty } = require('./utils/seed');

const app = express();
const httpServer = http.createServer(app);

// Attach Socket.IO
const io = initSocket(httpServer);
app.set('io', io);

// Body parser
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Enable CORS strictly (Phase 11 Security Hardening)
const clientOrigin = process.env.CLIENT_URL || 'http://localhost:3000';
app.use(
  cors({
    origin: clientOrigin,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

// Dev logging middleware
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.status(200).json({
    success: true,
    status: 'online',
    timestamp: new Date().toISOString(),
    service: 'Ticket Management System API',
  });
});

// Mount routers
app.use('/api/auth', authRoutes);
app.use('/api/tickets', ticketRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/sla', slaRoutes);

// Catch-all 404 for undefined routes
app.use((req, res, next) => {
  res.status(404).json({
    success: false,
    message: `API endpoint not found: ${req.method} ${req.originalUrl}`,
  });
});

// Global Central Error-Handling Middleware (Positioned at the very end of the stack to intercept SyntaxErrors & exceptions)
app.use(errorHandler);

// Fallback error-handling middleware for unhandled exceptions & SyntaxErrors
app.use((err, req, res, next) => {
  if (err instanceof SyntaxError && (err.status === 400 || err.statusCode === 400 || 'body' in err)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid JSON payload format.',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined,
    });
  }
  const statusCode = err.status || err.statusCode || 500;
  res.status(statusCode).json({
    success: false,
    message: err.message || 'Internal Server Error',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined,
  });
});

const PORT = process.env.PORT || 5001;

// Start server if not in test mode
if (process.env.NODE_ENV !== 'test') {
  connectDB().then(async () => {
    await seedDefaultsIfEmpty();
    httpServer.listen(PORT, () => {
      console.log(
        `[Server] Running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT} (with Socket.IO enabled)`
      );
      initSLAMonitor();
    });
  });
}

module.exports = app;
module.exports.httpServer = httpServer;
module.exports.io = io;
