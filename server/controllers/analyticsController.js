const mongoose = require('mongoose');
const Ticket = require('../models/Ticket');
const User = require('../models/User');
const Notification = require('../models/Notification');

// @desc    Get system-wide ticket overview metrics
// @route   GET /api/analytics/overview
// @access  Private (Admin only)
const getOverviewMetrics = async (req, res, next) => {
  try {
    const [counts] = await Ticket.aggregate([
      {
        $facet: {
          total: [{ $count: 'count' }],
          open: [{ $match: { status: 'Open' } }, { $count: 'count' }],
          assigned: [{ $match: { status: 'Assigned' } }, { $count: 'count' }],
          inProgress: [{ $match: { status: 'In Progress' } }, { $count: 'count' }],
          resolved: [{ $match: { status: 'Resolved' } }, { $count: 'count' }],
          closed: [{ $match: { status: 'Closed' } }, { $count: 'count' }],
          critical: [{ $match: { priority: 'Critical' } }, { $count: 'count' }],
          unassigned: [{ $match: { assignedTo: null } }, { $count: 'count' }],
        },
      },
    ]);

    const overview = {
      totalTickets: counts.total[0]?.count || 0,
      openTickets: counts.open[0]?.count || 0,
      assignedTickets: counts.assigned[0]?.count || 0,
      inProgressTickets: counts.inProgress[0]?.count || 0,
      resolvedTickets: counts.resolved[0]?.count || 0,
      closedTickets: counts.closed[0]?.count || 0,
      criticalTickets: counts.critical[0]?.count || 0,
      unassignedTickets: counts.unassigned[0]?.count || 0,
    };

    res.status(200).json({
      success: true,
      overview,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get ticket distribution by status
// @route   GET /api/analytics/status
// @access  Private (Admin only)
const getStatusDistribution = async (req, res, next) => {
  try {
    const distribution = await Ticket.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
        },
      },
      {
        $project: {
          _id: 0,
          status: '$_id',
          count: 1,
        },
      },
      {
        $sort: { count: -1 },
      },
    ]);

    res.status(200).json({
      success: true,
      distribution,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get ticket distribution by priority
// @route   GET /api/analytics/priority
// @access  Private (Admin only)
const getPriorityDistribution = async (req, res, next) => {
  try {
    const distribution = await Ticket.aggregate([
      {
        $group: {
          _id: '$priority',
          count: { $sum: 1 },
        },
      },
      {
        $project: {
          _id: 0,
          priority: '$_id',
          count: 1,
        },
      },
      {
        $sort: { count: -1 },
      },
    ]);

    res.status(200).json({
      success: true,
      distribution,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get ticket distribution by category
// @route   GET /api/analytics/category
// @access  Private (Admin only)
const getCategoryDistribution = async (req, res, next) => {
  try {
    const distribution = await Ticket.aggregate([
      {
        $group: {
          _id: '$category',
          count: { $sum: 1 },
        },
      },
      {
        $project: {
          _id: 0,
          category: '$_id',
          count: 1,
        },
      },
      {
        $sort: { count: -1 },
      },
    ]);

    res.status(200).json({
      success: true,
      distribution,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get agent workload statistics
// @route   GET /api/analytics/agents
// @access  Private (Admin only)
const getAgentWorkload = async (req, res, next) => {
  try {
    // Retrieve all active agents
    const agents = await User.find({ role: 'agent', isActive: true }).select(
      'name email department'
    );

    // Aggregate ticket counts grouped by assignedTo and status
    const workloadAgg = await Ticket.aggregate([
      {
        $match: {
          assignedTo: { $ne: null },
        },
      },
      {
        $group: {
          _id: {
            agentId: '$assignedTo',
            status: '$status',
          },
          count: { $sum: 1 },
        },
      },
    ]);

    // Build consolidated workload mapping
    const workloadMap = {};
    agents.forEach((ag) => {
      workloadMap[ag._id.toString()] = {
        agentId: ag._id,
        name: ag.name,
        email: ag.email,
        department: ag.department || 'General Support',
        assigned: 0,
        inProgress: 0,
        resolved: 0,
        closed: 0,
        total: 0,
      };
    });

    workloadAgg.forEach((item) => {
      const agId = item._id.agentId.toString();
      if (!workloadMap[agId]) {
        workloadMap[agId] = {
          agentId: item._id.agentId,
          name: 'Assigned Agent',
          email: '',
          department: 'Support',
          assigned: 0,
          inProgress: 0,
          resolved: 0,
          closed: 0,
          total: 0,
        };
      }

      const st = item._id.status;
      if (st === 'Assigned') workloadMap[agId].assigned += item.count;
      else if (st === 'In Progress') workloadMap[agId].inProgress += item.count;
      else if (st === 'Resolved') workloadMap[agId].resolved += item.count;
      else if (st === 'Closed') workloadMap[agId].closed += item.count;

      workloadMap[agId].total += item.count;
    });

    const workload = Object.values(workloadMap).sort((a, b) => b.total - a.total);

    res.status(200).json({
      success: true,
      workload,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get ticket creation trend over time
// @route   GET /api/analytics/trends
// @access  Private (Admin only)
const getTicketCreationTrends = async (req, res, next) => {
  try {
    const match = {};

    if (req.query.fromDate || req.query.toDate) {
      match.createdAt = {};
      if (req.query.fromDate) {
        const from = new Date(req.query.fromDate);
        if (isNaN(from.getTime())) {
          return res.status(400).json({ success: false, message: 'Invalid fromDate parameter' });
        }
        match.createdAt.$gte = from;
      }
      if (req.query.toDate) {
        const to = new Date(req.query.toDate);
        if (isNaN(to.getTime())) {
          return res.status(400).json({ success: false, message: 'Invalid toDate parameter' });
        }
        to.setHours(23, 59, 59, 999);
        match.createdAt.$lte = to;
      }
    }

    const trends = await Ticket.aggregate([
      ...(Object.keys(match).length > 0 ? [{ $match: match }] : []),
      {
        $group: {
          _id: {
            $dateToString: { format: '%Y-%m-%d', date: '$createdAt' },
          },
          count: { $sum: 1 },
        },
      },
      {
        $project: {
          _id: 0,
          date: '$_id',
          count: 1,
        },
      },
      {
        $sort: { date: 1 },
      },
    ]);

    res.status(200).json({
      success: true,
      trends,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get SLA overview metrics
// @route   GET /api/analytics/sla/overview
// @access  Private (Admin only)
const getSLAOverview = async (req, res, next) => {
  try {
    const now = new Date();
    const approachingResponseThreshold = new Date(now.getTime() + 2 * 60 * 60 * 1000);
    const approachingResolutionThreshold = new Date(now.getTime() + 4 * 60 * 60 * 1000);

    const [facetResult] = await Ticket.aggregate([
      {
        $facet: {
          total: [{ $count: 'count' }],
          responseBreaches: [
            { $match: { 'sla.responseBreached': true } },
            { $count: 'count' },
          ],
          resolutionBreaches: [
            { $match: { 'sla.resolutionBreached': true } },
            { $count: 'count' },
          ],
          withinSLA: [
            {
              $match: {
                'sla.responseBreached': { $ne: true },
                'sla.resolutionBreached': { $ne: true },
              },
            },
            { $count: 'count' },
          ],
          approachingResponse: [
            {
              $match: {
                status: 'Open',
                'sla.firstRespondedAt': null,
                'sla.responseBreached': { $ne: true },
                'sla.responseDueAt': { $gte: now, $lte: approachingResponseThreshold },
              },
            },
            { $count: 'count' },
          ],
          approachingResolution: [
            {
              $match: {
                status: { $nin: ['Resolved', 'Closed'] },
                'sla.resolutionBreached': { $ne: true },
                'sla.resolutionDueAt': { $gte: now, $lte: approachingResolutionThreshold },
              },
            },
            { $count: 'count' },
          ],
        },
      },
    ]);

    const totalTickets = facetResult.total[0]?.count || 0;
    const responseBreaches = facetResult.responseBreaches[0]?.count || 0;
    const resolutionBreaches = facetResult.resolutionBreaches[0]?.count || 0;
    const ticketsWithinSLA = facetResult.withinSLA[0]?.count || 0;
    const approachingResponseDeadline = facetResult.approachingResponse[0]?.count || 0;
    const approachingResolutionDeadline = facetResult.approachingResolution[0]?.count || 0;

    res.status(200).json({
      success: true,
      slaOverview: {
        totalTickets,
        ticketsWithinSLA,
        responseBreaches,
        resolutionBreaches,
        approachingResponseDeadline,
        approachingResolutionDeadline,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get SLA performance grouped by priority
// @route   GET /api/analytics/sla/priority
// @access  Private (Admin only)
const getSLAPriority = async (req, res, next) => {
  try {
    const priorityBreakdown = await Ticket.aggregate([
      {
        $group: {
          _id: '$priority',
          total: { $sum: 1 },
          responseBreaches: {
            $sum: { $cond: [{ $eq: ['$sla.responseBreached', true] }, 1, 0] },
          },
          resolutionBreaches: {
            $sum: { $cond: [{ $eq: ['$sla.resolutionBreached', true] }, 1, 0] },
          },
          withinSLA: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $ne: ['$sla.responseBreached', true] },
                    { $ne: ['$sla.resolutionBreached', true] },
                  ],
                },
                1,
                0,
              ],
            },
          },
        },
      },
      {
        $project: {
          _id: 0,
          priority: '$_id',
          total: 1,
          responseBreaches: 1,
          resolutionBreaches: 1,
          withinSLA: 1,
        },
      },
    ]);

    // Ensure all 4 priorities are represented
    const prioritiesOrder = ['Critical', 'High', 'Medium', 'Low'];
    const map = {};
    priorityBreakdown.forEach((p) => {
      map[p.priority] = p;
    });

    const result = prioritiesOrder.map(
      (prio) =>
        map[prio] || {
          priority: prio,
          total: 0,
          responseBreaches: 0,
          resolutionBreaches: 0,
          withinSLA: 0,
        }
    );

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get SLA performance grouped by support agent
// @route   GET /api/analytics/sla/agents
// @access  Private (Admin only)
const getSLAAgents = async (req, res, next) => {
  try {
    const agents = await Ticket.aggregate([
      {
        $match: {
          assignedTo: { $ne: null },
        },
      },
      {
        $group: {
          _id: '$assignedTo',
          assignedTickets: { $sum: 1 },
          resolvedTickets: {
            $sum: { $cond: [{ $in: ['$status', ['Resolved', 'Closed']] }, 1, 0] },
          },
          responseBreaches: {
            $sum: { $cond: [{ $eq: ['$sla.responseBreached', true] }, 1, 0] },
          },
          resolutionBreaches: {
            $sum: { $cond: [{ $eq: ['$sla.resolutionBreached', true] }, 1, 0] },
          },
        },
      },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'agentInfo',
        },
      },
      {
        $unwind: '$agentInfo',
      },
      {
        $project: {
          _id: 0,
          agentId: '$_id',
          agent: '$agentInfo.name',
          assignedTickets: 1,
          resolvedTickets: 1,
          responseBreaches: 1,
          resolutionBreaches: 1,
        },
      },
    ]);

    res.status(200).json({
      success: true,
      agents,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get SLA breach trends by date
// @route   GET /api/analytics/sla/trends
// @access  Private (Admin only)
const getSLATrends = async (req, res, next) => {
  try {
    const match = {
      $or: [
        { 'sla.responseBreached': true },
        { 'sla.resolutionBreached': true },
      ],
    };

    if (req.query.fromDate || req.query.toDate) {
      match.createdAt = {};
      if (req.query.fromDate) {
        const from = new Date(req.query.fromDate);
        if (isNaN(from.getTime())) {
          return res.status(400).json({ success: false, message: 'Invalid fromDate parameter' });
        }
        match.createdAt.$gte = from;
      }
      if (req.query.toDate) {
        const to = new Date(req.query.toDate);
        if (isNaN(to.getTime())) {
          return res.status(400).json({ success: false, message: 'Invalid toDate parameter' });
        }
        to.setHours(23, 59, 59, 999);
        match.createdAt.$lte = to;
      }
    }

    const trends = await Ticket.aggregate([
      { $match: match },
      {
        $group: {
          _id: {
            $dateToString: { format: '%Y-%m-%d', date: '$createdAt' },
          },
          responseBreaches: {
            $sum: { $cond: [{ $eq: ['$sla.responseBreached', true] }, 1, 0] },
          },
          resolutionBreaches: {
            $sum: { $cond: [{ $eq: ['$sla.resolutionBreached', true] }, 1, 0] },
          },
          totalBreaches: { $sum: 1 },
        },
      },
      {
        $project: {
          _id: 0,
          date: '$_id',
          responseBreaches: 1,
          resolutionBreaches: 1,
          totalBreaches: 1,
        },
      },
      {
        $sort: { date: 1 },
      },
    ]);

    res.status(200).json({
      success: true,
      trends,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get role-specific dashboard metrics, aggregations and recent tickets
// @route   GET /api/analytics/dashboard
// @access  Private (User, Agent, Admin)
const getRoleSpecificDashboard = async (req, res, next) => {
  try {
    const role = req.user.role;
    const userId = req.user._id;

    if (role === 'user') {
      const [totalTickets, openTickets, inProgressTickets, resolvedTickets, closedTickets] = await Promise.all([
        Ticket.countDocuments({ createdBy: userId }),
        Ticket.countDocuments({ createdBy: userId, status: 'Open' }),
        Ticket.countDocuments({ createdBy: userId, status: 'In Progress' }),
        Ticket.countDocuments({ createdBy: userId, status: 'Resolved' }),
        Ticket.countDocuments({ createdBy: userId, status: 'Closed' }),
      ]);

      const recentTickets = await Ticket.find({ createdBy: userId })
        .sort({ createdAt: -1 })
        .limit(6)
        .populate('assignedTo', 'name email department');

      return res.status(200).json({
        success: true,
        role: 'user',
        stats: {
          totalTickets,
          openTickets,
          inProgressTickets,
          resolvedTickets,
          closedTickets,
        },
        recentTickets,
      });
    }

    if (role === 'agent') {
      const [assignedTickets, openAssigned, inProgressAssigned, resolvedAssigned, highCriticalAssigned] = await Promise.all([
        Ticket.countDocuments({ assignedTo: userId }),
        Ticket.countDocuments({ assignedTo: userId, status: { $in: ['Open', 'Assigned'] } }),
        Ticket.countDocuments({ assignedTo: userId, status: 'In Progress' }),
        Ticket.countDocuments({ assignedTo: userId, status: 'Resolved' }),
        Ticket.countDocuments({ assignedTo: userId, priority: { $in: ['High', 'Critical'] }, status: { $ne: 'Closed' } }),
      ]);

      const recentTickets = await Ticket.find({ assignedTo: userId })
        .sort({ updatedAt: -1 })
        .limit(6)
        .populate('createdBy', 'name email department')
        .populate('assignedTo', 'name email department');

      return res.status(200).json({
        success: true,
        role: 'agent',
        stats: {
          assignedTickets,
          openAssigned,
          inProgressAssigned,
          resolvedAssigned,
          highCriticalAssigned,
        },
        recentTickets,
      });
    }

    if (role === 'admin') {
      const [
        totalUsers,
        totalAgents,
        totalTickets,
        openTickets,
        assignedTickets,
        inProgressTickets,
        resolvedTickets,
        closedTickets,
        highCriticalTickets,
        statusDistribution,
        priorityDistribution,
        categoryDistribution,
        creationTrends,
        recentTickets,
        recentNotifications,
        unreadNotificationCount,
      ] = await Promise.all([
        User.countDocuments({ role: 'user' }),
        User.countDocuments({ role: 'agent' }),
        Ticket.countDocuments(),
        Ticket.countDocuments({ status: 'Open' }),
        Ticket.countDocuments({ status: 'Assigned' }),
        Ticket.countDocuments({ status: 'In Progress' }),
        Ticket.countDocuments({ status: 'Resolved' }),
        Ticket.countDocuments({ status: 'Closed' }),
        Ticket.countDocuments({ priority: { $in: ['High', 'Critical'] } }),
        Ticket.aggregate([
          { $group: { _id: '$status', count: { $sum: 1 } } },
          { $project: { _id: 0, status: '$_id', count: 1 } },
          { $sort: { count: -1 } },
        ]),
        Ticket.aggregate([
          { $group: { _id: '$priority', count: { $sum: 1 } } },
          { $project: { _id: 0, priority: '$_id', count: 1 } },
          { $sort: { count: -1 } },
        ]),
        Ticket.aggregate([
          { $group: { _id: '$category', count: { $sum: 1 } } },
          { $project: { _id: 0, category: '$_id', count: 1 } },
          { $sort: { count: -1 } },
        ]),
        Ticket.aggregate([
          {
            $group: {
              _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
              count: { $sum: 1 },
            },
          },
          { $project: { _id: 0, date: '$_id', count: 1 } },
          { $sort: { date: 1 } },
        ]),
        Ticket.find()
          .sort({ createdAt: -1 })
          .limit(6)
          .populate('createdBy', 'name email department')
          .populate('assignedTo', 'name email department'),
        Notification.find({ recipient: userId })
          .sort({ createdAt: -1 })
          .limit(10)
          .populate('ticket', 'ticketId title status priority'),
        Notification.countDocuments({ recipient: userId, isRead: false }),
      ]);

      return res.status(200).json({
        success: true,
        role: 'admin',
        stats: {
          totalUsers,
          totalAgents,
          totalTickets,
          openTickets,
          assignedTickets,
          inProgressTickets,
          resolvedTickets,
          closedTickets,
          highCriticalTickets,
        },
        charts: {
          statusDistribution,
          priorityDistribution,
          categoryDistribution,
          creationTrends,
        },
        recentTickets,
        recentNotifications,
        unreadNotificationCount,
      });
    }

    return res.status(400).json({
      success: false,
      message: `Unsupported user role: ${role}`,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getOverviewMetrics,
  getStatusDistribution,
  getPriorityDistribution,
  getCategoryDistribution,
  getAgentWorkload,
  getTicketCreationTrends,
  getSLAOverview,
  getSLAPriority,
  getSLAAgents,
  getSLATrends,
  getRoleSpecificDashboard,
};

