const express = require('express');
const router = express.Router();
const {
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
} = require('../controllers/analyticsController');
const { protect, authorize } = require('../middleware/auth');

// All analytics endpoints require valid JWT authentication
router.use(protect);

// Role-specific dashboard endpoint (accessible to all authenticated roles: user, agent, admin)
router.get('/dashboard', getRoleSpecificDashboard);

// Administrative analytics endpoints restricted to Administrators
router.use(authorize('admin'));

router.get('/overview', getOverviewMetrics);
router.get('/status', getStatusDistribution);
router.get('/priority', getPriorityDistribution);
router.get('/category', getCategoryDistribution);
router.get('/agents', getAgentWorkload);
router.get('/trends', getTicketCreationTrends);

// SLA Analytics Endpoints (Admin only)
router.get('/sla/overview', getSLAOverview);
router.get('/sla/priority', getSLAPriority);
router.get('/sla/agents', getSLAAgents);
router.get('/sla/trends', getSLATrends);

module.exports = router;
