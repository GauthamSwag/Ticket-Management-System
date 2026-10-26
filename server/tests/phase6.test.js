const { test, describe, before, after } = require('node:test');
const assert = require('node:assert');
const request = require('supertest');
const { connectDB, disconnectDB } = require('../config/db');

process.env.NODE_ENV = 'test';
process.env.MONGO_URI = 'memory';
process.env.JWT_SECRET = 'test_jwt_secret_key_12345';

let app;
const User = require('../models/User');
const Ticket = require('../models/Ticket');
const Counter = require('../models/Counter');

describe('Phase 6 — Role-Specific Dashboards Suite', () => {
  let user1Token, user1Id;
  let user2Token, user2Id;
  let agentToken, agentId;
  let adminToken, adminId;

  before(async () => {
    await connectDB();
    app = require('../server');

    await User.deleteMany({});
    await Ticket.deleteMany({});
    await Counter.deleteMany({});

    // Register User 1
    const u1Res = await request(app).post('/api/auth/register').send({
      name: 'Dashboard User 1',
      email: 'dash_user1@example.com',
      password: 'password123',
    });
    user1Token = u1Res.body.token;
    user1Id = u1Res.body.user._id;

    // Register User 2
    const u2Res = await request(app).post('/api/auth/register').send({
      name: 'Dashboard User 2',
      email: 'dash_user2@example.com',
      password: 'password123',
    });
    user2Token = u2Res.body.token;
    user2Id = u2Res.body.user._id;

    // Seed Agent
    const agent = await User.create({
      name: 'Dashboard Agent',
      email: 'dash_agent@example.com',
      password: 'password123',
      role: 'agent',
    });
    agentId = agent._id;
    const agentLogin = await request(app).post('/api/auth/login').send({
      email: 'dash_agent@example.com',
      password: 'password123',
    });
    agentToken = agentLogin.body.token;

    // Seed Admin
    const admin = await User.create({
      name: 'Dashboard Admin',
      email: 'dash_admin@example.com',
      password: 'password123',
      role: 'admin',
    });
    adminId = admin._id;
    const adminLogin = await request(app).post('/api/auth/login').send({
      email: 'dash_admin@example.com',
      password: 'password123',
    });
    adminToken = adminLogin.body.token;

    // Create tickets for User 1
    // Ticket 1: Open, High, Network
    await Ticket.create({
      ticketId: 'TKT-000001',
      title: 'User 1 Open Network Issue',
      description: 'WiFi dropouts in building 4',
      category: 'Network',
      priority: 'High',
      status: 'Open',
      createdBy: user1Id,
    });

    // Ticket 2: Assigned to agent, Critical, Technical Issue
    await Ticket.create({
      ticketId: 'TKT-000002',
      title: 'User 1 Assigned Critical Incident',
      description: 'Production API returning 500 status',
      category: 'Technical Issue',
      priority: 'Critical',
      status: 'Assigned',
      createdBy: user1Id,
      assignedTo: agentId,
    });

    // Ticket 3: In Progress assigned to agent, Medium, Software
    await Ticket.create({
      ticketId: 'TKT-000003',
      title: 'User 1 In Progress Software Issue',
      description: 'Application memory leak on background jobs',
      category: 'Software',
      priority: 'Medium',
      status: 'In Progress',
      createdBy: user1Id,
      assignedTo: agentId,
    });

    // Ticket 4: Resolved assigned to agent, Low, Billing
    await Ticket.create({
      ticketId: 'TKT-000004',
      title: 'User 1 Resolved Billing Question',
      description: 'Invoice discrepancy for last month',
      category: 'Billing',
      priority: 'Low',
      status: 'Resolved',
      createdBy: user1Id,
      assignedTo: agentId,
      resolvedAt: new Date(),
    });

    // Ticket 5: Closed by admin, Low, Hardware
    await Ticket.create({
      ticketId: 'TKT-000005',
      title: 'User 1 Closed Hardware Request',
      description: 'Replacement mouse requested',
      category: 'Hardware',
      priority: 'Low',
      status: 'Closed',
      createdBy: user1Id,
      closedAt: new Date(),
    });

    // Create tickets for User 2 (Should NOT be visible in User 1's dashboard)
    await Ticket.create({
      ticketId: 'TKT-000006',
      title: 'User 2 Account Locked',
      description: 'Password reset attempts exceeded',
      category: 'Account Issue',
      priority: 'High',
      status: 'Open',
      createdBy: user2Id,
    });
  });

  after(async () => {
    await disconnectDB();
  });

  // ---------------------------------------------------------------------------
  // AUTHENTICATION & SECURITY
  // ---------------------------------------------------------------------------
  test('1. GET /api/analytics/dashboard requires authentication', async () => {
    const res = await request(app).get('/api/analytics/dashboard');
    assert.strictEqual(res.status, 401);
  });

  // ---------------------------------------------------------------------------
  // USER DASHBOARD
  // ---------------------------------------------------------------------------
  test('2. User dashboard returns scoped metrics for User 1', async () => {
    const res = await request(app)
      .get('/api/analytics/dashboard')
      .set('Authorization', `Bearer ${user1Token}`);

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.role, 'user');

    const stats = res.body.stats;
    assert.strictEqual(stats.totalTickets, 5); // 5 created by User 1
    assert.strictEqual(stats.openTickets, 1);
    assert.strictEqual(stats.inProgressTickets, 1);
    assert.strictEqual(stats.resolvedTickets, 1);
    assert.strictEqual(stats.closedTickets, 1);
  });

  test('3. User dashboard returns only recent tickets created by requesting user', async () => {
    const res = await request(app)
      .get('/api/analytics/dashboard')
      .set('Authorization', `Bearer ${user1Token}`);

    assert.strictEqual(res.status, 200);
    assert.ok(Array.isArray(res.body.recentTickets));
    assert.strictEqual(res.body.recentTickets.length, 5);

    // Verify all tickets in recentTickets belong to user1
    res.body.recentTickets.forEach((t) => {
      assert.notStrictEqual(t.ticketId, 'TKT-000006'); // User 2's ticket must never appear
    });
  });

  test('4. User 2 dashboard returns separate scoped metrics', async () => {
    const res = await request(app)
      .get('/api/analytics/dashboard')
      .set('Authorization', `Bearer ${user2Token}`);

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.role, 'user');
    assert.strictEqual(res.body.stats.totalTickets, 1);
    assert.strictEqual(res.body.stats.openTickets, 1);
    assert.strictEqual(res.body.recentTickets.length, 1);
    assert.strictEqual(res.body.recentTickets[0].ticketId, 'TKT-000006');
  });

  // ---------------------------------------------------------------------------
  // AGENT DASHBOARD
  // ---------------------------------------------------------------------------
  test('5. Agent dashboard returns assigned queue metrics', async () => {
    const res = await request(app)
      .get('/api/analytics/dashboard')
      .set('Authorization', `Bearer ${agentToken}`);

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.role, 'agent');

    const stats = res.body.stats;
    assert.strictEqual(stats.assignedTickets, 3); // Tickets 2, 3, 4 assigned to agent
    assert.strictEqual(stats.openAssigned, 1);    // Ticket 2 is 'Assigned'
    assert.strictEqual(stats.inProgressAssigned, 1); // Ticket 3
    assert.strictEqual(stats.resolvedAssigned, 1);   // Ticket 4
    assert.strictEqual(stats.highCriticalAssigned, 1); // Ticket 2 is Critical
  });

  test('6. Agent dashboard returns recently assigned tickets with creator populated', async () => {
    const res = await request(app)
      .get('/api/analytics/dashboard')
      .set('Authorization', `Bearer ${agentToken}`);

    assert.strictEqual(res.status, 200);
    assert.ok(Array.isArray(res.body.recentTickets));
    assert.strictEqual(res.body.recentTickets.length, 3);

    // Each ticket should have creator populated
    res.body.recentTickets.forEach((t) => {
      assert.ok(t.createdBy);
      assert.strictEqual(t.assignedTo._id.toString(), agentId.toString());
    });
  });

  // ---------------------------------------------------------------------------
  // ADMIN DASHBOARD
  // ---------------------------------------------------------------------------
  test('7. Admin dashboard returns global system metrics', async () => {
    const res = await request(app)
      .get('/api/analytics/dashboard')
      .set('Authorization', `Bearer ${adminToken}`);

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.role, 'admin');

    const stats = res.body.stats;
    assert.strictEqual(stats.totalTickets, 6); // All 6 tickets in database
    assert.strictEqual(stats.totalUsers, 2);   // User 1, User 2
    assert.strictEqual(stats.totalAgents, 1);  // 1 Agent
    assert.strictEqual(stats.openTickets, 2);  // Tickets 1, 6
    assert.strictEqual(stats.assignedTickets, 1); // Ticket 2
    assert.strictEqual(stats.inProgressTickets, 1); // Ticket 3
    assert.strictEqual(stats.resolvedTickets, 1);   // Ticket 4
    assert.strictEqual(stats.closedTickets, 1);     // Ticket 5
    assert.strictEqual(stats.highCriticalTickets, 3); // High: 1, 6. Critical: 2
  });

  test('8. Admin dashboard returns backend chart aggregations (Status, Priority, Category, Trends)', async () => {
    const res = await request(app)
      .get('/api/analytics/dashboard')
      .set('Authorization', `Bearer ${adminToken}`);

    assert.strictEqual(res.status, 200);
    const charts = res.body.charts;
    assert.ok(charts);

    // Status distribution
    assert.ok(Array.isArray(charts.statusDistribution));
    assert.ok(charts.statusDistribution.length > 0);
    const openStatus = charts.statusDistribution.find((s) => s.status === 'Open');
    assert.strictEqual(openStatus.count, 2);

    // Priority distribution
    assert.ok(Array.isArray(charts.priorityDistribution));
    assert.ok(charts.priorityDistribution.length > 0);

    // Category distribution
    assert.ok(Array.isArray(charts.categoryDistribution));
    assert.ok(charts.categoryDistribution.length > 0);

    // Creation trends
    assert.ok(Array.isArray(charts.creationTrends));
    assert.ok(charts.creationTrends.length > 0);
    assert.ok(charts.creationTrends[0].date);
    assert.ok(typeof charts.creationTrends[0].count === 'number');
  });

  test('9. Admin dashboard returns global recent tickets', async () => {
    const res = await request(app)
      .get('/api/analytics/dashboard')
      .set('Authorization', `Bearer ${adminToken}`);

    assert.strictEqual(res.status, 200);
    assert.ok(Array.isArray(res.body.recentTickets));
    assert.strictEqual(res.body.recentTickets.length, 6);
  });

  test('10. Non-admin users cannot access admin-only analytics routes (/overview, /status)', async () => {
    const resOverview = await request(app)
      .get('/api/analytics/overview')
      .set('Authorization', `Bearer ${user1Token}`);
    assert.strictEqual(resOverview.status, 403);

    const resStatus = await request(app)
      .get('/api/analytics/status')
      .set('Authorization', `Bearer ${agentToken}`);
    assert.strictEqual(resStatus.status, 403);
  });
});
