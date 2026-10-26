const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Ticket = require('../models/Ticket');

let io = null;

const initSocket = (httpServer) => {
  io = new Server(httpServer, {
    cors: {
      origin: process.env.CLIENT_URL || 'http://localhost:3000',
      credentials: true,
      methods: ['GET', 'POST'],
    },
    pingTimeout: 60000,
    pingInterval: 25000,
  });

  // JWT Authentication Middleware for Socket.IO
  io.use(async (socket, next) => {
    try {
      let token = socket.handshake.auth?.token || socket.handshake.headers?.authorization;

      if (!token) {
        return next(new Error('Authentication error: Token required'));
      }

      if (token.startsWith('Bearer ')) {
        token = token.slice(7).trim();
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret123');
      const user = await User.findById(decoded.id).select('-password');

      if (!user) {
        return next(new Error('Authentication error: User not found'));
      }

      if (!user.isActive) {
        return next(new Error('Authentication error: User account is inactive'));
      }

      socket.user = user;
      next();
    } catch (err) {
      return next(new Error('Authentication error: Invalid or expired token'));
    }
  });

  io.on('connection', (socket) => {
    const userId = socket.user._id.toString();
    const userRole = socket.user.role;

    // Automatically join private user room for targeted notifications
    socket.join(`user:${userId}`);

    // If Admin, join global admins room
    if (userRole === 'admin') {
      socket.join('admins');
    }

    // Handle joining a ticket discussion room with strict RBAC authorization
    socket.on('join:ticket', async (data, callback) => {
      try {
        const ticketIdParam = data?.ticketId || data;
        if (!ticketIdParam) {
          if (callback) callback({ success: false, message: 'Ticket ID required' });
          return;
        }

        // Find ticket by ObjectId or human-readable ticketId
        let ticket;
        if (ticketIdParam.match(/^[0-9a-fA-F]{24}$/)) {
          ticket = await Ticket.findById(ticketIdParam);
        }
        if (!ticket) {
          ticket = await Ticket.findOne({ ticketId: ticketIdParam.toUpperCase() });
        }

        if (!ticket) {
          if (callback) callback({ success: false, message: 'Ticket not found' });
          return;
        }

        // Verify authorization
        let authorized = false;
        if (socket.user.role === 'admin') {
          authorized = true;
        } else if (socket.user.role === 'user') {
          authorized = ticket.createdBy.toString() === socket.user._id.toString();
        } else if (socket.user.role === 'agent') {
          authorized =
            ticket.assignedTo && ticket.assignedTo.toString() === socket.user._id.toString();
        }

        if (!authorized) {
          socket.emit('error:room', {
            message: 'Forbidden: You are not authorized to join this ticket room',
          });
          if (callback) {
            callback({
              success: false,
              message: 'Forbidden: Not authorized to join room',
            });
          }
          return;
        }

        const roomName = `ticket:${ticket._id.toString()}`;
        socket.join(roomName);

        if (callback) {
          callback({
            success: true,
            room: roomName,
            ticketId: ticket.ticketId,
          });
        }
      } catch (err) {
        if (callback) callback({ success: false, message: err.message });
      }
    });

    // Handle leaving a ticket room
    socket.on('leave:ticket', (data) => {
      const ticketIdParam = data?.ticketId || data;
      if (ticketIdParam) {
        socket.leave(`ticket:${ticketIdParam}`);
      }
    });

    socket.on('disconnect', () => {
      // Clean up automatically handled by Socket.IO
    });
  });

  return io;
};

const getIO = () => {
  return io;
};

// Real-time emission helpers
const emitToTicket = (ticketId, event, data) => {
  if (!io) return;
  const idStr = ticketId?.toString();
  const payload = {
    ticketId: idStr,
    event,
    data,
    timestamp: new Date().toISOString(),
  };
  io.to(`ticket:${idStr}`).emit(event, payload);
};

const emitToUser = (userId, event, data) => {
  if (!io) return;
  const idStr = userId?.toString();
  const payload = {
    event,
    data,
    timestamp: new Date().toISOString(),
  };
  io.to(`user:${idStr}`).emit(event, payload);
};

const emitToAdmins = (event, data) => {
  if (!io) return;
  const payload = {
    event,
    data,
    timestamp: new Date().toISOString(),
  };
  io.to('admins').emit(event, payload);
};

const emitToAll = (event, data) => {
  if (!io) return;
  const payload = {
    event,
    data,
    timestamp: new Date().toISOString(),
  };
  io.emit(event, payload);
};

module.exports = {
  initSocket,
  getIO,
  emitToTicket,
  emitToUser,
  emitToAdmins,
  emitToAll,
};
