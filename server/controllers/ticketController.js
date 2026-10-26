const mongoose = require('mongoose');
const fs = require('fs');
const Ticket = require('../models/Ticket');
const User = require('../models/User');
const SLA = require('../models/SLA');
const Attachment = require('../models/Attachment');
const Comment = require('../models/Comment');
const TicketHistory = require('../models/TicketHistory');
const Notification = require('../models/Notification');
const logTicketHistory = require('../utils/historyLogger');
const { emitToTicket, emitToAdmins } = require('../socket');
const { sendNotification } = require('../utils/notificationService');
const { sendTicketAssignmentEmail, sendStatusChangeEmail } = require('../services/emailService');
const { classifyTicket } = require('../services/aiClassificationService');

// Helper to find ticket by ObjectId or human-readable ticketId
const findTicketByIdOrCustomId = async (idParam) => {
  if (idParam && typeof idParam === 'string' && idParam.toUpperCase().startsWith('TKT-')) {
    return await Ticket.findOne({ ticketId: idParam.toUpperCase() })
      .populate('createdBy', 'name email role department')
      .populate('assignedTo', 'name email role department');
  }
  return await Ticket.findById(idParam)
    .populate('createdBy', 'name email role department')
    .populate('assignedTo', 'name email role department');
};

// @desc    Create a new ticket
// @route   POST /api/tickets
// @access  Private (All authenticated roles: User, Agent, Admin)
const createTicket = async (req, res, next) => {
  try {
    const { title, description, category, priority } = req.body;

    // Rigorous validation: presence and string type
    if (!title || typeof title !== 'string' || title.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Please provide both title and description for the ticket',
      });
    }

    if (!description || typeof description !== 'string' || description.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Please provide both title and description for the ticket',
      });
    }

    if (title.trim().length > 150) {
      return res.status(400).json({
        success: false,
        message: 'Ticket title cannot exceed 150 characters',
      });
    }

    if (description.trim().length > 5000) {
      return res.status(400).json({
        success: false,
        message: 'Ticket description cannot exceed 5000 characters',
      });
    }

    // Enum validation: Category
    const validCategories = Ticket.CATEGORIES || [
      'Technical Issue',
      'Account Issue',
      'Billing',
      'Software',
      'Hardware',
      'Network',
      'Other',
    ];
    if (category !== undefined && category !== null) {
      if (typeof category !== 'string' || !validCategories.includes(category.trim())) {
        return res.status(400).json({
          success: false,
          message: `Invalid category: '${category}'. Supported categories: ${validCategories.join(', ')}`,
        });
      }
    }

    // Enum validation: Priority
    const validPriorities = Ticket.PRIORITIES || ['Low', 'Medium', 'High', 'Critical'];
    if (priority !== undefined && priority !== null) {
      if (typeof priority !== 'string' || !validPriorities.includes(priority.trim())) {
        return res.status(400).json({
          success: false,
          message: `Invalid priority: '${priority}'. Supported priorities: ${validPriorities.join(', ')}`,
        });
      }
    }

    const ticketPriority = priority || 'Medium';
    const slaConfig = await SLA.getSLAForPriority(ticketPriority);
    const responseDueAt = new Date(Date.now() + slaConfig.responseTimeHours * 3600000);
    const resolutionDueAt = new Date(Date.now() + slaConfig.resolutionTimeHours * 3600000);

    const ticket = await Ticket.create({
      title: title.trim(),
      description: description.trim(),
      category: category || 'Technical Issue',
      priority: ticketPriority,
      status: 'Open',
      createdBy: req.user.id,
      sla: {
        responseDueAt,
        resolutionDueAt,
        responseBreached: false,
        resolutionBreached: false,
        firstRespondedAt: null,
      },
    });

    // Record audit history
    await logTicketHistory(
      ticket._id,
      req.user.id,
      'TICKET_CREATED',
      `${req.user.name} (${req.user.role}) created ticket ${ticket.ticketId}`,
      null,
      {
        title: ticket.title,
        category: ticket.category,
        priority: ticket.priority,
        status: ticket.status,
      }
    );

    const populatedTicket = await Ticket.findById(ticket._id)
      .populate('createdBy', 'name email role department')
      .populate('assignedTo', 'name email role department');

    // Real-time broadcast to admins
    emitToAdmins('ticket:created', populatedTicket);

    // Send persistent notifications to active admins
    const adminUsers = await User.find({ role: 'admin', isActive: true }).select('_id');
    for (const adm of adminUsers) {
      if (adm._id.toString() !== req.user.id.toString()) {
        await sendNotification({
          recipient: adm._id,
          type: 'TICKET_CREATED',
          title: `New Ticket Created: ${ticket.ticketId}`,
          message: `${req.user.name} created ticket "${ticket.title}".`,
          ticket: ticket._id,
        });
      }
    }

    res.status(201).json({
      success: true,
      message: 'Ticket created successfully',
      ticket: populatedTicket,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get tickets according to logged-in user role with search, filtering, sorting & pagination
// @route   GET /api/tickets
// @access  Private
const getTickets = async (req, res, next) => {
  try {
    let filter = {};

    // 1. Role-based scoping (Enforced first to prevent cross-tenant data leakage)
    if (req.user.role === 'user') {
      filter.createdBy = req.user.id;
    } else if (req.user.role === 'agent') {
      filter.assignedTo = req.user.id;
    }

    // 2. Field Filters & Enum Boundaries
    if (req.query.status) {
      const validStatuses = Ticket.STATUSES || ['Open', 'Assigned', 'In Progress', 'Resolved', 'Closed'];
      if (!validStatuses.includes(req.query.status)) {
        return res.status(400).json({
          success: false,
          message: `Invalid status parameter '${req.query.status}'. Allowed values: ${validStatuses.join(', ')}`,
        });
      }
      filter.status = req.query.status;
    }
    if (req.query.priority) {
      const validPriorities = Ticket.PRIORITIES || ['Low', 'Medium', 'High', 'Critical'];
      if (!validPriorities.includes(req.query.priority)) {
        return res.status(400).json({
          success: false,
          message: `Invalid priority parameter '${req.query.priority}'. Allowed values: ${validPriorities.join(', ')}`,
        });
      }
      filter.priority = req.query.priority;
    }
    if (req.query.category) {
      const validCategories = Ticket.CATEGORIES || [
        'Technical Issue',
        'Account Issue',
        'Billing',
        'Software',
        'Hardware',
        'Network',
        'Other',
      ];
      if (!validCategories.includes(req.query.category)) {
        return res.status(400).json({
          success: false,
          message: `Invalid category parameter '${req.query.category}'. Allowed values: ${validCategories.join(', ')}`,
        });
      }
      filter.category = req.query.category;
    }
    if (req.query.assignedTo && req.user.role === 'admin') {
      filter.assignedTo = req.query.assignedTo;
    }
    if (req.query.createdBy && req.user.role === 'admin') {
      filter.createdBy = req.query.createdBy;
    }

    // 3. SLA Status Filtering
    if (req.query.slaStatus) {
      const validSlaStatuses = ['within_sla', 'approaching', 'response_breached', 'resolution_breached'];
      if (!validSlaStatuses.includes(req.query.slaStatus)) {
        return res.status(400).json({
          success: false,
          message: `Invalid slaStatus parameter. Allowed values: ${validSlaStatuses.join(', ')}`,
        });
      }

      if (req.query.slaStatus === 'within_sla') {
        filter['sla.responseBreached'] = false;
        filter['sla.resolutionBreached'] = false;
      } else if (req.query.slaStatus === 'approaching') {
        filter.status = { $nin: ['Resolved', 'Closed'] };
        filter['sla.resolutionBreached'] = false;
        filter['sla.resolutionDueAt'] = {
          $lte: new Date(Date.now() + 4 * 3600000),
          $gte: new Date(),
        };
      } else if (req.query.slaStatus === 'response_breached') {
        filter['sla.responseBreached'] = true;
      } else if (req.query.slaStatus === 'resolution_breached') {
        filter['sla.resolutionBreached'] = true;
      }
    }

    // 4. Date Range Filtering (createdAt)
    if (req.query.fromDate || req.query.toDate) {
      const dateFilter = {};
      if (req.query.fromDate) {
        const from = new Date(req.query.fromDate);
        if (isNaN(from.getTime())) {
          return res.status(400).json({
            success: false,
            message: 'Invalid fromDate parameter. Use YYYY-MM-DD or ISO 8601 date string.',
          });
        }
        dateFilter.$gte = from;
      }
      if (req.query.toDate) {
        const to = new Date(req.query.toDate);
        if (isNaN(to.getTime())) {
          return res.status(400).json({
            success: false,
            message: 'Invalid toDate parameter. Use YYYY-MM-DD or ISO 8601 date string.',
          });
        }
        to.setHours(23, 59, 59, 999);
        dateFilter.$lte = to;
      }
      filter.createdAt = dateFilter;
    }

    // 4. Advanced Search (Case-insensitive across ticketId, title, description, category)
    if (req.query.search && req.query.search.trim()) {
      const searchStr = req.query.search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const searchConditions = [
        { ticketId: { $regex: searchStr, $options: 'i' } },
        { title: { $regex: searchStr, $options: 'i' } },
        { description: { $regex: searchStr, $options: 'i' } },
        { category: { $regex: searchStr, $options: 'i' } },
      ];

      if (Object.keys(filter).length > 0) {
        filter = { $and: [filter, { $or: searchConditions }] };
      } else {
        filter = { $or: searchConditions };
      }
    }

    // 5. Sorting Validation & Mapping
    // Supports both 'sort' convenience alias and 'sortBy'/'sortOrder' parameters
    let sortObj = { createdAt: -1 }; // Default to newest

    if (req.query.sort) {
      const s = req.query.sort.toLowerCase().trim();
      if (s === 'newest') {
        sortObj = { createdAt: -1 };
      } else if (s === 'oldest') {
        sortObj = { createdAt: 1 };
      } else if (s === 'recently_updated' || s === 'updated') {
        sortObj = { updatedAt: -1 };
      } else if (s === 'priority' || s === 'priority_desc' || s === 'priority_high') {
        sortObj = { priority: -1 };
      } else if (s === 'priority_asc' || s === 'priority_low') {
        sortObj = { priority: 1 };
      } else if (s === 'title_asc') {
        sortObj = { title: 1 };
      } else if (s === 'title_desc') {
        sortObj = { title: -1 };
      }
      // Invalid sort parameters in 'sort' are safely ignored and fallback to default (newest)
    } else if (req.query.sortBy) {
      const ALLOWED_SORTS = ['createdAt', 'updatedAt', 'priority', 'status', 'ticketId', 'title'];
      if (!ALLOWED_SORTS.includes(req.query.sortBy)) {
        return res.status(400).json({
          success: false,
          message: `Invalid sortBy parameter. Allowed fields: ${ALLOWED_SORTS.join(', ')}`,
        });
      }
      const sortOrder = req.query.sortOrder === 'asc' ? 1 : -1;
      sortObj = { [req.query.sortBy]: sortOrder };
    }

    // 6. Pagination Validation
    if (req.query.page !== undefined) {
      const p = parseInt(req.query.page, 10);
      if (isNaN(p) || p <= 0) {
        return res.status(400).json({
          success: false,
          message: 'Invalid page number. Page must be a positive integer.',
        });
      }
    }

    if (req.query.limit !== undefined) {
      const l = parseInt(req.query.limit, 10);
      if (isNaN(l) || l <= 0 || l > 100) {
        return res.status(400).json({
          success: false,
          message: 'Invalid limit parameter. Limit must be an integer between 1 and 100.',
        });
      }
    }

    const totalItems = await Ticket.countDocuments(filter);
    const page = parseInt(req.query.page, 10) || 1;
    const limit = req.query.limit ? Math.min(parseInt(req.query.limit, 10), 100) : 10;
    const skip = (page - 1) * limit;

    const tickets = await Ticket.find(filter)
      .populate('createdBy', 'name email role department')
      .populate('assignedTo', 'name email role department')
      .sort(sortObj)
      .skip(skip)
      .limit(limit);

    const totalPages = Math.ceil(totalItems / limit) || 1;

    res.status(200).json({
      success: true,
      count: tickets.length,
      tickets,
      pagination: {
        page,
        currentPage: page,
        limit,
        totalItems,
        totalPages,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single ticket by ID
// @route   GET /api/tickets/:id
// @access  Private
const getTicketById = async (req, res, next) => {
  try {
    const ticket = await findTicketByIdOrCustomId(req.params.id);

    if (!ticket) {
      return res.status(404).json({
        success: false,
        message: 'Ticket not found',
      });
    }

    // Role-based access validation
    if (req.user.role === 'admin') {
      // Admin has universal read access
    } else if (req.user.role === 'agent') {
      // Agent can view only tickets assigned to them
      const isAssigned = ticket.assignedTo && ticket.assignedTo._id.toString() === req.user.id;
      if (!isAssigned) {
        return res.status(403).json({
          success: false,
          message: 'You are not authorized to view this ticket as it is not assigned to you',
        });
      }
    } else if (req.user.role === 'user') {
      // User can view only tickets created by them
      const isCreator = ticket.createdBy && ticket.createdBy._id.toString() === req.user.id;
      if (!isCreator) {
        return res.status(403).json({
          success: false,
          message: 'You are not authorized to view this ticket',
        });
      }
    }

    res.status(200).json({
      success: true,
      ticket,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update ticket details
// @route   PUT /api/tickets/:id
// @access  Private
const updateTicket = async (req, res, next) => {
  try {
    const ticket = await findTicketByIdOrCustomId(req.params.id);

    if (!ticket) {
      return res.status(404).json({
        success: false,
        message: 'Ticket not found',
      });
    }

    const { title, description, category, priority } = req.body;

    const validCategories = Ticket.CATEGORIES || [
      'Technical Issue',
      'Account Issue',
      'Billing',
      'Software',
      'Hardware',
      'Network',
      'Other',
    ];
    const validPriorities = Ticket.PRIORITIES || ['Low', 'Medium', 'High', 'Critical'];

    if (title !== undefined) {
      if (typeof title !== 'string' || title.trim().length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Ticket title cannot be empty',
        });
      }
      if (title.trim().length > 150) {
        return res.status(400).json({
          success: false,
          message: 'Ticket title cannot exceed 150 characters',
        });
      }
    }

    if (description !== undefined) {
      if (typeof description !== 'string' || description.trim().length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Ticket description cannot be empty',
        });
      }
      if (description.trim().length > 5000) {
        return res.status(400).json({
          success: false,
          message: 'Ticket description cannot exceed 5000 characters',
        });
      }
    }

    if (category !== undefined) {
      if (typeof category !== 'string' || !validCategories.includes(category.trim())) {
        return res.status(400).json({
          success: false,
          message: `Invalid category: '${category}'. Supported categories: ${validCategories.join(', ')}`,
        });
      }
    }

    if (priority !== undefined) {
      if (typeof priority !== 'string' || !validPriorities.includes(priority.trim())) {
        return res.status(400).json({
          success: false,
          message: `Invalid priority: '${priority}'. Supported priorities: ${validPriorities.join(', ')}`,
        });
      }
    }

    // Track old values for audit logging
    const oldValues = {
      title: ticket.title,
      description: ticket.description,
      category: ticket.category,
      priority: ticket.priority,
    };

    // Role authorization check
    if (req.user.role === 'admin') {
      if (title) ticket.title = title.trim();
      if (description) ticket.description = description.trim();
      if (category) ticket.category = category;
      if (priority) ticket.priority = priority;
    } else if (req.user.role === 'agent') {
      const isAssigned = ticket.assignedTo && ticket.assignedTo._id.toString() === req.user.id;
      if (!isAssigned) {
        return res.status(403).json({
          success: false,
          message: 'You are not authorized to modify tickets that are not assigned to you',
        });
      }
      if (title) ticket.title = title.trim();
      if (description) ticket.description = description.trim();
      if (category) ticket.category = category;
      if (priority) ticket.priority = priority;
    } else if (req.user.role === 'user') {
      const isCreator = ticket.createdBy && ticket.createdBy._id.toString() === req.user.id;
      if (!isCreator) {
        return res.status(403).json({
          success: false,
          message: 'You are not authorized to modify this ticket',
        });
      }

      if (ticket.status !== 'Open') {
        return res.status(400).json({
          success: false,
          message: `Cannot edit ticket once status has transitioned to '${ticket.status}'. Only Open tickets can be modified by users.`,
        });
      }

      if (title) ticket.title = title.trim();
      if (description) ticket.description = description.trim();
      if (category) ticket.category = category;
      if (priority) ticket.priority = priority;
    }

    await ticket.save();

    // Record audit history
    await logTicketHistory(
      ticket._id,
      req.user.id,
      'TICKET_UPDATED',
      `${req.user.name} (${req.user.role}) updated ticket details`,
      oldValues,
      {
        title: ticket.title,
        description: ticket.description,
        category: ticket.category,
        priority: ticket.priority,
      }
    );

    const updated = await findTicketByIdOrCustomId(ticket._id);

    // Emit real-time ticket:updated
    emitToTicket(ticket._id, 'ticket:updated', updated);

    res.status(200).json({
      success: true,
      message: 'Ticket updated successfully',
      ticket: updated,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete ticket
// @route   DELETE /api/tickets/:id
// @access  Private
const deleteTicket = async (req, res, next) => {
  try {
    const ticket = await findTicketByIdOrCustomId(req.params.id);

    if (!ticket) {
      return res.status(404).json({
        success: false,
        message: 'Ticket not found',
      });
    }

    // Role checks
    if (req.user.role === 'admin') {
      // Clean up associated attachments from disk
      const attachments = await Attachment.find({ ticket: ticket._id });
      for (const att of attachments) {
        if (fs.existsSync(att.filePath)) {
          try {
            await fs.promises.unlink(att.filePath);
          } catch (e) {
            console.error('Failed to unlink attachment on ticket delete:', e.message);
          }
        }
      }

      await Attachment.deleteMany({ ticket: ticket._id });
      await Comment.deleteMany({ ticket: ticket._id });
      await TicketHistory.deleteMany({ ticket: ticket._id });
      await Notification.deleteMany({ ticket: ticket._id });
      await Ticket.deleteOne({ _id: ticket._id });

      return res.status(200).json({
        success: true,
        message: 'Ticket deleted successfully by administrator',
      });
    }

    if (req.user.role === 'user') {
      const isCreator = ticket.createdBy && ticket.createdBy._id.toString() === req.user.id;
      if (!isCreator) {
        return res.status(403).json({
          success: false,
          message: 'You are not authorized to delete this ticket',
        });
      }

      if (ticket.status !== 'Open') {
        return res.status(400).json({
          success: false,
          message: 'Only Open tickets can be deleted by the user',
        });
      }

      // Clean up associated attachments from disk
      const attachments = await Attachment.find({ ticket: ticket._id });
      for (const att of attachments) {
        if (fs.existsSync(att.filePath)) {
          try {
            await fs.promises.unlink(att.filePath);
          } catch (e) {
            console.error('Failed to unlink attachment on ticket delete:', e.message);
          }
        }
      }

      await Attachment.deleteMany({ ticket: ticket._id });
      await Comment.deleteMany({ ticket: ticket._id });
      await TicketHistory.deleteMany({ ticket: ticket._id });
      await Notification.deleteMany({ ticket: ticket._id });
      await Ticket.deleteOne({ _id: ticket._id });

      return res.status(200).json({
        success: true,
        message: 'Ticket deleted successfully',
      });
    }

    return res.status(403).json({
      success: false,
      message: 'Support agents are not authorized to delete tickets',
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Assign ticket to an agent (Admin only)
// @route   PUT /api/tickets/:id/assign
// @access  Private (Admin only)
const assignTicket = async (req, res, next) => {
  try {
    const ticket = await findTicketByIdOrCustomId(req.params.id);

    if (!ticket) {
      return res.status(404).json({
        success: false,
        message: 'Ticket not found',
      });
    }

    const { agentId } = req.body;

    if (!agentId) {
      return res.status(400).json({
        success: false,
        message: 'Please provide an agentId to assign the ticket',
      });
    }

    // Verify target user exists and has role 'agent'
    const agent = await User.findById(agentId);
    if (!agent) {
      return res.status(404).json({
        success: false,
        message: 'Target support agent not found',
      });
    }

    if (agent.role !== 'agent') {
      return res.status(400).json({
        success: false,
        message: `User '${agent.name}' has role '${agent.role}'. Tickets can only be assigned to users with the 'agent' role.`,
      });
    }

    if (!agent.isActive) {
      return res.status(400).json({
        success: false,
        message: `Agent account '${agent.name}' is currently deactivated`,
      });
    }

    const wasAssigned = !!ticket.assignedTo;
    const oldAgentName = ticket.assignedTo ? ticket.assignedTo.name : 'Unassigned';

    // Update assignment
    ticket.assignedTo = agent._id;

    // Transition status to Assigned if currently Open
    if (ticket.status === 'Open') {
      ticket.status = 'Assigned';
    }

    if (ticket.sla && !ticket.sla.firstRespondedAt) {
      ticket.sla.firstRespondedAt = new Date();
    }

    await ticket.save();

    // Record audit history
    const action = wasAssigned ? 'TICKET_REASSIGNED' : 'TICKET_ASSIGNED';
    const description = wasAssigned
      ? `${req.user.name} reassigned ticket from ${oldAgentName} to ${agent.name}`
      : `${req.user.name} assigned ticket to ${agent.name}`;

    await logTicketHistory(
      ticket._id,
      req.user.id,
      action,
      description,
      oldAgentName,
      agent.name
    );

    const updated = await findTicketByIdOrCustomId(ticket._id);

    // Emit real-time ticket:assigned
    emitToTicket(ticket._id, 'ticket:assigned', {
      ticketId: ticket.ticketId,
      previousAgent: oldAgentName,
      newAgent: agent.name,
      assignedBy: req.user.name,
      ticket: updated,
    });
    emitToAdmins('ticket:assigned', {
      ticketId: ticket.ticketId,
      ticket: updated,
    });

    // Send persistent notification to the assigned support agent
    await sendNotification({
      recipient: agent._id,
      type: 'TICKET_ASSIGNED',
      title: `Ticket Assigned: ${ticket.ticketId}`,
      message: `You have been assigned to ticket "${ticket.title}" by ${req.user.name}.`,
      ticket: ticket._id,
    });

    // Send email alert to agent (asynchronous, non-blocking)
    sendTicketAssignmentEmail({
      agentId: agent._id,
      ticket,
      assignedBy: req.user,
    }).catch((e) => console.error('[Email] Failed to send assignment email:', e.message));

    res.status(200).json({
      success: true,
      message: `Ticket successfully assigned to agent ${agent.name}`,
      ticket: updated,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update ticket status following workflow
// @route   PUT /api/tickets/:id/status
// @access  Private (Agent assigned or Admin)
const updateTicketStatus = async (req, res, next) => {
  try {
    const ticket = await findTicketByIdOrCustomId(req.params.id);

    if (!ticket) {
      return res.status(404).json({
        success: false,
        message: 'Ticket not found',
      });
    }

    const { status: newStatus } = req.body;
    const validStatuses = ['Open', 'Assigned', 'In Progress', 'Resolved', 'Closed'];

    if (!newStatus || !validStatuses.includes(newStatus)) {
      return res.status(400).json({
        success: false,
        message: `Invalid status. Valid statuses are: ${validStatuses.join(', ')}`,
      });
    }

    // Role permissions check
    if (req.user.role === 'user') {
      return res.status(403).json({
        success: false,
        message: 'Users are not authorized to change ticket workflow status',
      });
    }

    if (req.user.role === 'agent') {
      const isAssigned = ticket.assignedTo && ticket.assignedTo._id.toString() === req.user.id;
      if (!isAssigned) {
        return res.status(403).json({
          success: false,
          message: 'You can only update status for tickets assigned to you',
        });
      }
    }

    const current = ticket.status;

    // Define valid transitions
    const validTransitions = {
      Open: ['Assigned', 'In Progress'],
      Assigned: ['In Progress', 'Open'],
      'In Progress': ['Resolved', 'Assigned'],
      Resolved: ['Closed', 'In Progress'],
      Closed: ['In Progress', 'Open'],
    };

    const allowedNext = validTransitions[current] || [];
    if (current !== newStatus && !allowedNext.includes(newStatus) && req.user.role !== 'admin') {
      return res.status(400).json({
        success: false,
        message: `Invalid status transition from '${current}' to '${newStatus}'. Allowed transitions from '${current}': ${allowedNext.join(', ')}.`,
      });
    }

    ticket.status = newStatus;

    if (ticket.sla && !ticket.sla.firstRespondedAt) {
      ticket.sla.firstRespondedAt = new Date();
    }

    // Handle timestamps
    if (newStatus === 'Resolved') {
      ticket.resolvedAt = Date.now();
      if (ticket.sla && ticket.sla.resolutionDueAt && new Date() <= ticket.sla.resolutionDueAt) {
        ticket.sla.resolutionBreached = false;
      }
    } else if (newStatus === 'Closed') {
      ticket.closedAt = Date.now();
      if (!ticket.resolvedAt) {
        ticket.resolvedAt = Date.now();
      }
    } else {
      if (newStatus === 'Open' || newStatus === 'In Progress' || newStatus === 'Assigned') {
        ticket.closedAt = null;
        if (newStatus !== 'Resolved') {
          ticket.resolvedAt = null;
        }
      }
    }

    await ticket.save();

    // Record audit history
    await logTicketHistory(
      ticket._id,
      req.user.id,
      'STATUS_CHANGED',
      `${req.user.name} changed status from '${current}' to '${newStatus}'`,
      current,
      newStatus
    );

    const updated = await findTicketByIdOrCustomId(ticket._id);

    // Emit real-time status changed
    emitToTicket(ticket._id, 'ticket:statusChanged', {
      ticketId: ticket.ticketId,
      oldStatus: current,
      newStatus,
      changedBy: req.user.name,
      ticket: updated,
    });
    emitToAdmins('ticket:statusChanged', {
      ticketId: ticket.ticketId,
      ticket: updated,
    });

    // Notify ticket creator if someone else updated status
    if (ticket.createdBy && ticket.createdBy._id.toString() !== req.user.id) {
      await sendNotification({
        recipient: ticket.createdBy._id || ticket.createdBy,
        type: 'TICKET_STATUS_CHANGED',
        title: `Ticket ${ticket.ticketId} Status Changed`,
        message: `Status transitioned from ${current} to ${newStatus} by ${req.user.name}.`,
        ticket: ticket._id,
      });
    }

    // If Admin changed status and ticket is assigned to an agent, notify agent
    if (
      req.user.role === 'admin' &&
      ticket.assignedTo &&
      ticket.assignedTo._id.toString() !== req.user.id
    ) {
      await sendNotification({
        recipient: ticket.assignedTo._id || ticket.assignedTo,
        type: 'TICKET_STATUS_CHANGED',
        title: `Assigned Ticket Status Updated`,
        message: `Status of ticket ${ticket.ticketId} was updated to ${newStatus} by Administrator ${req.user.name}.`,
        ticket: ticket._id,
      });
    }

    // Send email alert to ticket creator (asynchronous, non-blocking)
    if (ticket.createdBy) {
      sendStatusChangeEmail({
        userId: ticket.createdBy._id || ticket.createdBy,
        ticket,
        oldStatus: current,
        newStatus,
        changedBy: req.user,
      }).catch((e) => console.error('[Email] Failed to send status change email:', e.message));
    }

    res.status(200).json({
      success: true,
      message: `Ticket status successfully updated to '${newStatus}'`,
      ticket: updated,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update ticket priority
// @route   PUT /api/tickets/:id/priority
// @access  Private (Agent assigned or Admin)
const updateTicketPriority = async (req, res, next) => {
  try {
    const ticket = await findTicketByIdOrCustomId(req.params.id);

    if (!ticket) {
      return res.status(404).json({
        success: false,
        message: 'Ticket not found',
      });
    }

    const { priority } = req.body;
    const validPriorities = ['Low', 'Medium', 'High', 'Critical'];

    if (!priority || !validPriorities.includes(priority)) {
      return res.status(400).json({
        success: false,
        message: `Invalid priority. Valid options: ${validPriorities.join(', ')}`,
      });
    }

    // Role checks
    if (req.user.role === 'user') {
      return res.status(403).json({
        success: false,
        message: 'Users are not authorized to adjust priority once submitted',
      });
    }

    if (req.user.role === 'agent') {
      const isAssigned = ticket.assignedTo && ticket.assignedTo._id.toString() === req.user.id;
      if (!isAssigned) {
        return res.status(403).json({
          success: false,
          message: 'You can only adjust priority for tickets assigned to you',
        });
      }
    }

    const oldPriority = ticket.priority;
    ticket.priority = priority;
    await ticket.save();

    // Record audit history
    await logTicketHistory(
      ticket._id,
      req.user.id,
      'PRIORITY_CHANGED',
      `${req.user.name} adjusted priority from '${oldPriority}' to '${priority}'`,
      oldPriority,
      priority
    );

    const updated = await findTicketByIdOrCustomId(ticket._id);

    // Emit real-time priority changed
    emitToTicket(ticket._id, 'ticket:priorityChanged', {
      ticketId: ticket.ticketId,
      oldPriority,
      newPriority: priority,
      changedBy: req.user.name,
      ticket: updated,
    });
    emitToAdmins('ticket:priorityChanged', {
      ticketId: ticket.ticketId,
      ticket: updated,
    });

    if (ticket.createdBy && ticket.createdBy._id.toString() !== req.user.id) {
      await sendNotification({
        recipient: ticket.createdBy._id || ticket.createdBy,
        type: 'TICKET_PRIORITY_CHANGED',
        title: `Ticket Priority Adjusted: ${ticket.ticketId}`,
        message: `Priority adjusted from ${oldPriority} to ${priority} by ${req.user.name}.`,
        ticket: ticket._id,
      });
    }

    res.status(200).json({
      success: true,
      message: `Ticket priority updated to '${priority}'`,
      ticket: updated,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    AI-assisted ticket classification suggestion
// @route   POST /api/tickets/:id/classify
// @access  Private (Creator, Assigned Agent, Admin)
const classifyTicketEndpoint = async (req, res, next) => {
  try {
    const ticket = await findTicketByIdOrCustomId(req.params.id);

    if (!ticket) {
      return res.status(404).json({
        success: false,
        message: 'Ticket not found',
      });
    }

    // Role check: Only Creator, Assigned Agent, or Admin can request AI classification
    if (req.user.role === 'user') {
      const isCreator = ticket.createdBy && ticket.createdBy._id.toString() === req.user.id;
      if (!isCreator) {
        return res.status(403).json({
          success: false,
          message: 'You are not authorized to classify this ticket',
        });
      }
    } else if (req.user.role === 'agent') {
      const isAssigned = ticket.assignedTo && ticket.assignedTo._id.toString() === req.user.id;
      if (!isAssigned) {
        return res.status(403).json({
          success: false,
          message: 'You are not authorized to classify tickets not assigned to you',
        });
      }
    }

    const classification = await classifyTicket({
      title: ticket.title,
      description: ticket.description,
    });

    // Record audit history entry
    await logTicketHistory(
      ticket._id,
      req.user.id,
      'AI_CLASSIFICATION_REQUESTED',
      `${req.user.name} requested AI classification suggestion`,
      null,
      classification.suggestion
    );

    res.status(200).json({
      success: true,
      available: classification.available,
      suggestion: classification.suggestion,
      message: classification.message,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createTicket,
  getTickets,
  getTicketById,
  updateTicket,
  deleteTicket,
  assignTicket,
  updateTicketStatus,
  updateTicketPriority,
  classifyTicketEndpoint,
};
