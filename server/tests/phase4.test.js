const { test, describe, before, after } = require('node:test');
const assert = require('node:assert');
const request = require('supertest');
const ioClient = require('socket.io-client');
const { connectDB, disconnectDB } = require('../config/db');
const User = require('../models/User');
const Ticket = require('../models/Ticket');
const Comment = require('../models/Comment');
const Notification = require('../models/Notification');
const TicketHistory = require('../models/TicketHistory');

process.env.NODE_ENV = 'test';
process.env.MONGO_URI = 'memory';
process.env.JWT_SECRET = 'test_jwt_secret_key_12345';

let app;
let httpServer;
let serverPort;

describe('Phase 4 — Real-time, Search, Pagination, Notifications & Analytics Suite', () => {
  let user1Token, user2Token, agentToken, adminToken;
  let user1Id, user2Id, agentId, adminId;
  let ticket1Id, ticket2Id, ticket3Id;
  let ticket1CustomId, ticket2CustomId, ticket3CustomId;

  before(async () => {
    await connectDB();
    app = require('../server');

    // Clean all collections
    await User.deleteMany({});
    await Ticket.deleteMany({});
    await Comment.deleteMany({});
    await Notification.deleteMany({});
    await TicketHistory.deleteMany({});

    // Start HTTP server on ephemeral port for socket tests
    await new Promise((resolve) => {
      httpServer = app.httpServer.listen(0, () => {
        serverPort = httpServer.address().port;
        resolve();
      });
    });

    // 1. Create Users
    const u1 = await request(app)
      .post('/api/auth/register')
      .send({ name: 'User One', email: 'user1@test.com', password: 'Password123!', role: 'user' });
    user1Token = u1.body.token;
    user1Id = u1.body.user._id;

    const u2 = await request(app)
      .post('/api/auth/register')
      .send({ name: 'User Two', email: 'user2@test.com', password: 'Password123!', role: 'user' });
    user2Token = u2.body.token;
    user2Id = u2.body.user._id;

    const ag = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Agent Support', email: 'agent@test.com', password: 'Password123!', role: 'agent' });
    agentToken = ag.body.token;
    agentId = ag.body.user._id;

    const adm = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Admin Master', email: 'admin@test.com', password: 'Password123!', role: 'admin' });
    adminToken = adm.body.token;
    adminId = adm.body.user._id;

    // 2. Create Sample Tickets
    // Ticket 1: User 1, Technical Issue, High
    const t1 = await request(app)
      .post('/api/tickets')
      .set('Authorization', `Bearer ${user1Token}`)
      .send({
        title: 'Database connection latency spike',
        description: 'Queries are timing out in production cluster',
        category: 'Technical Issue',
        priority: 'High',
      });
    ticket1Id = t1.body.ticket._id;
    ticket1CustomId = t1.body.ticket.ticketId;

    // Ticket 2: User 1, Billing, Critical
    const t2 = await request(app)
      .post('/api/tickets')
      .set('Authorization', `Bearer ${user1Token}`)
      .send({
        title: 'Credit card double charge',
        description: 'Monthly invoice was charged twice on account',
        category: 'Billing',
        priority: 'Critical',
      });
    ticket2Id = t2.body.ticket._id;
    ticket2CustomId = t2.body.ticket.ticketId;

    // Ticket 3: User 2, Account Issue, Low
    const t3 = await request(app)
      .post('/api/tickets')
      .set('Authorization', `Bearer ${user2Token}`)
      .send({
        title: 'Password reset email not received',
        description: 'User cannot reset password for secondary email',
        category: 'Account Issue',
        priority: 'Low',
      });
    ticket3Id = t3.body.ticket._id;
    ticket3CustomId = t3.body.ticket.ticketId;

    // Admin assigns Ticket 1 to Agent
    await request(app)
      .put(`/api/tickets/${ticket1Id}/assign`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ agentId });
  });

  after(async () => {
    if (httpServer) {
      await new Promise((resolve) => httpServer.close(resolve));
    }
    await disconnectDB();
  });

  // ==========================================
  // SECTION A: ADVANCED SEARCH TESTS
  // ==========================================

  test('1. Search by exact ticket ID returns matching ticket', async () => {
    const res = await request(app)
      .get(`/api/tickets?search=${ticket1CustomId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.tickets.length, 1);
    assert.strictEqual(res.body.tickets[0].ticketId, ticket1CustomId);
  });

  test('2. Search by title keyword returns matching tickets', async () => {
    const res = await request(app)
      .get('/api/tickets?search=latency')
      .set('Authorization', `Bearer ${adminToken}`);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.tickets.length, 1);
    assert.strictEqual(res.body.tickets[0].title, 'Database connection latency spike');
  });

  test('3. Search is case-insensitive', async () => {
    const res = await request(app)
      .get('/api/tickets?search=LATENCY')
      .set('Authorization', `Bearer ${adminToken}`);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.tickets.length, 1);
    assert.strictEqual(res.body.tickets[0].title, 'Database connection latency spike');
  });

  test('4. User search only returns tickets within their owned scope', async () => {
    // User 1 searches for 'password', which is in Ticket 3 (created by User 2)
    const res = await request(app)
      .get('/api/tickets?search=password')
      .set('Authorization', `Bearer ${user1Token}`);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.tickets.length, 0); // Must be 0 because Ticket 3 belongs to User 2
  });

  test('5. Agent search only returns tickets within their assigned scope', async () => {
    // Agent searches for 'double charge' (Ticket 2, which is unassigned)
    const res = await request(app)
      .get('/api/tickets?search=charge')
      .set('Authorization', `Bearer ${agentToken}`);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.tickets.length, 0); // Ticket 2 is not assigned to this agent

    // Agent searches for 'latency' (Ticket 1, assigned to this agent)
    const res2 = await request(app)
      .get('/api/tickets?search=latency')
      .set('Authorization', `Bearer ${agentToken}`);
    assert.strictEqual(res2.status, 200);
    assert.strictEqual(res2.body.tickets.length, 1);
  });

  test('6. Admin search returns global results across all users and agents', async () => {
    const res = await request(app)
      .get('/api/tickets?search=password')
      .set('Authorization', `Bearer ${adminToken}`);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.tickets.length, 1);
    assert.strictEqual(res.body.tickets[0].ticketId, ticket3CustomId);
  });

  // ==========================================
  // SECTION B: FILTERING & DATES
  // ==========================================

  test('7. Filter by status returns only tickets in that status', async () => {
    const res = await request(app)
      .get('/api/tickets?status=Assigned')
      .set('Authorization', `Bearer ${adminToken}`);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.tickets.length, 1);
    assert.strictEqual(res.body.tickets[0].status, 'Assigned');
  });

  test('8. Filter by priority returns only tickets of specified priority', async () => {
    const res = await request(app)
      .get('/api/tickets?priority=Critical')
      .set('Authorization', `Bearer ${adminToken}`);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.tickets.length, 1);
    assert.strictEqual(res.body.tickets[0].priority, 'Critical');
  });

  test('9. Filter by category returns tickets matching that category', async () => {
    const res = await request(app)
      .get('/api/tickets?category=Billing')
      .set('Authorization', `Bearer ${adminToken}`);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.tickets.length, 1);
    assert.strictEqual(res.body.tickets[0].category, 'Billing');
  });

  test('10. Combine multiple filters (status, priority, and category)', async () => {
    const res = await request(app)
      .get('/api/tickets?status=Open&priority=Critical&category=Billing')
      .set('Authorization', `Bearer ${adminToken}`);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.tickets.length, 1);
    assert.strictEqual(res.body.tickets[0].ticketId, ticket2CustomId);
  });

  test('11. Date filtering works correctly for fromDate and toDate', async () => {
    const today = new Date().toISOString().split('T')[0];
    const res = await request(app)
      .get(`/api/tickets?fromDate=${today}&toDate=${today}`)
      .set('Authorization', `Bearer ${adminToken}`);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.tickets.length, 3);
  });

  test('12. Invalid date parameter is rejected with 400 Bad Request', async () => {
    const res = await request(app)
      .get('/api/tickets?fromDate=invalid-date-format')
      .set('Authorization', `Bearer ${adminToken}`);
    assert.strictEqual(res.status, 400);
    assert.strictEqual(res.body.success, false);
  });

  // ==========================================
  // SECTION C: SORTING
  // ==========================================

  test('13. Sort by createdAt ascending and descending', async () => {
    const resAsc = await request(app)
      .get('/api/tickets?sortBy=createdAt&sortOrder=asc')
      .set('Authorization', `Bearer ${adminToken}`);
    assert.strictEqual(resAsc.status, 200);
    assert.strictEqual(resAsc.body.tickets[0].ticketId, ticket1CustomId);

    const resDesc = await request(app)
      .get('/api/tickets?sortBy=createdAt&sortOrder=desc')
      .set('Authorization', `Bearer ${adminToken}`);
    assert.strictEqual(resDesc.status, 200);
    assert.strictEqual(resDesc.body.tickets[0].ticketId, ticket3CustomId);
  });

  test('14. Sort by priority works properly', async () => {
    const res = await request(app)
      .get('/api/tickets?sortBy=priority&sortOrder=asc')
      .set('Authorization', `Bearer ${adminToken}`);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.tickets.length, 3);
  });

  test('15. Invalid sort field is rejected with 400 Bad Request', async () => {
    const res = await request(app)
      .get('/api/tickets?sortBy=maliciousSqlInjection')
      .set('Authorization', `Bearer ${adminToken}`);
    assert.strictEqual(res.status, 400);
    assert.strictEqual(res.body.success, false);
  });

  // ==========================================
  // SECTION D: SERVER-SIDE PAGINATION
  // ==========================================

  test('16. Page 1 returns correct slice and pagination metadata', async () => {
    const res = await request(app)
      .get('/api/tickets?page=1&limit=2')
      .set('Authorization', `Bearer ${adminToken}`);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.tickets.length, 2);
    assert.strictEqual(res.body.pagination.page, 1);
    assert.strictEqual(res.body.pagination.limit, 2);
    assert.strictEqual(res.body.pagination.totalItems, 3);
    assert.strictEqual(res.body.pagination.totalPages, 2);
    assert.strictEqual(res.body.pagination.hasNextPage, true);
    assert.strictEqual(res.body.pagination.hasPreviousPage, false);
  });

  test('17. Page 2 returns next remaining records', async () => {
    const res = await request(app)
      .get('/api/tickets?page=2&limit=2')
      .set('Authorization', `Bearer ${adminToken}`);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.tickets.length, 1);
    assert.strictEqual(res.body.pagination.page, 2);
    assert.strictEqual(res.body.pagination.hasNextPage, false);
    assert.strictEqual(res.body.pagination.hasPreviousPage, true);
  });

  test('18. Pagination handles page beyond available records gracefully', async () => {
    const res = await request(app)
      .get('/api/tickets?page=99&limit=10')
      .set('Authorization', `Bearer ${adminToken}`);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.tickets.length, 0);
  });

  test('19. Maximum limit parameter (> 100) is rejected with 400 Bad Request', async () => {
    const res = await request(app)
      .get('/api/tickets?limit=500')
      .set('Authorization', `Bearer ${adminToken}`);
    assert.strictEqual(res.status, 400);
    assert.strictEqual(res.body.success, false);
  });

  // ==========================================
  // SECTION E: NOTIFICATIONS API & GENERATION
  // ==========================================

  test('20. Notification was generated for Agent upon ticket assignment', async () => {
    const res = await request(app)
      .get('/api/notifications')
      .set('Authorization', `Bearer ${agentToken}`);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.notifications.length >= 1, true);
    const notif = res.body.notifications.find((n) => n.type === 'TICKET_ASSIGNED');
    assert.ok(notif, 'Expected TICKET_ASSIGNED notification');
    assert.strictEqual(notif.isRead, false);
  });

  test('21. Notification generated for ticket creator upon status change', async () => {
    // Agent moves Ticket 1 to In Progress
    await request(app)
      .put(`/api/tickets/${ticket1Id}/status`)
      .set('Authorization', `Bearer ${agentToken}`)
      .send({ status: 'In Progress' });

    // User 1 should receive TICKET_STATUS_CHANGED notification
    const res = await request(app)
      .get('/api/notifications')
      .set('Authorization', `Bearer ${user1Token}`);
    assert.strictEqual(res.status, 200);
    const notif = res.body.notifications.find((n) => n.type === 'TICKET_STATUS_CHANGED');
    assert.ok(notif, 'Expected TICKET_STATUS_CHANGED notification');
  });

  test('22. User can retrieve their own notifications list', async () => {
    const res = await request(app)
      .get('/api/notifications')
      .set('Authorization', `Bearer ${user1Token}`);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert.ok(Array.isArray(res.body.notifications));
  });

  test('23. Unread notification count endpoint returns correct count', async () => {
    const res = await request(app)
      .get('/api/notifications/unread-count')
      .set('Authorization', `Bearer ${user1Token}`);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(typeof res.body.count, 'number');
    assert.strictEqual(res.body.count >= 1, true);
  });

  test('24. User can mark a specific notification as read', async () => {
    const listRes = await request(app)
      .get('/api/notifications')
      .set('Authorization', `Bearer ${user1Token}`);
    const notifId = listRes.body.notifications[0]._id;

    const res = await request(app)
      .put(`/api/notifications/${notifId}/read`)
      .set('Authorization', `Bearer ${user1Token}`);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.notification.isRead, true);
  });

  test('25. User can mark all notifications as read', async () => {
    const res = await request(app)
      .put('/api/notifications/read-all')
      .set('Authorization', `Bearer ${user1Token}`);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);

    const countRes = await request(app)
      .get('/api/notifications/unread-count')
      .set('Authorization', `Bearer ${user1Token}`);
    assert.strictEqual(countRes.body.count, 0);
  });

  test('26. User cannot access or mark another user’s notification (403 Forbidden)', async () => {
    const agentList = await request(app)
      .get('/api/notifications')
      .set('Authorization', `Bearer ${agentToken}`);
    const agentNotifId = agentList.body.notifications[0]._id;

    const res = await request(app)
      .put(`/api/notifications/${agentNotifId}/read`)
      .set('Authorization', `Bearer ${user1Token}`);
    assert.strictEqual(res.status, 403);
  });

  // ==========================================
  // SECTION F: ANALYTICS API (ADMIN-ONLY)
  // ==========================================

  test('27. Admin can access overview metrics aggregation', async () => {
    const res = await request(app)
      .get('/api/analytics/overview')
      .set('Authorization', `Bearer ${adminToken}`);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.overview.totalTickets, 3);
    assert.strictEqual(typeof res.body.overview.openTickets, 'number');
    assert.strictEqual(typeof res.body.overview.inProgressTickets, 'number');
  });

  test('28. Non-admin user cannot access analytics overview (403 Forbidden)', async () => {
    const res = await request(app)
      .get('/api/analytics/overview')
      .set('Authorization', `Bearer ${user1Token}`);
    assert.strictEqual(res.status, 403);
  });

  test('29. Status aggregation returns distribution array', async () => {
    const res = await request(app)
      .get('/api/analytics/status')
      .set('Authorization', `Bearer ${adminToken}`);
    assert.strictEqual(res.status, 200);
    assert.ok(Array.isArray(res.body.distribution));
    const totalCount = res.body.distribution.reduce((acc, curr) => acc + curr.count, 0);
    assert.strictEqual(totalCount, 3);
  });

  test('30. Priority aggregation returns count breakdown', async () => {
    const res = await request(app)
      .get('/api/analytics/priority')
      .set('Authorization', `Bearer ${adminToken}`);
    assert.strictEqual(res.status, 200);
    assert.ok(Array.isArray(res.body.distribution));
  });

  test('31. Category aggregation returns breakdown', async () => {
    const res = await request(app)
      .get('/api/analytics/category')
      .set('Authorization', `Bearer ${adminToken}`);
    assert.strictEqual(res.status, 200);
    assert.ok(Array.isArray(res.body.distribution));
  });

  test('32. Agent workload aggregation returns agent statistics', async () => {
    const res = await request(app)
      .get('/api/analytics/agents')
      .set('Authorization', `Bearer ${adminToken}`);
    assert.strictEqual(res.status, 200);
    assert.ok(Array.isArray(res.body.workload));
    const agentWorkload = res.body.workload.find((w) => w.name === 'Agent Support');
    assert.ok(agentWorkload, 'Expected agent workload item');
    assert.strictEqual(agentWorkload.inProgress, 1);
  });

  test('33. Date trend aggregation returns timeline counts', async () => {
    const res = await request(app)
      .get('/api/analytics/trends')
      .set('Authorization', `Bearer ${adminToken}`);
    assert.strictEqual(res.status, 200);
    assert.ok(Array.isArray(res.body.trends));
    assert.strictEqual(res.body.trends.length >= 1, true);
  });

  // ==========================================
  // SECTION G: SOCKET.IO REAL-TIME & RBAC
  // ==========================================

  test('34. Authenticated socket connection accepted with valid JWT', async () => {
    const socket = ioClient(`http://localhost:${serverPort}`, {
      auth: { token: user1Token },
      transports: ['websocket'],
      forceNew: true,
    });

    await new Promise((resolve, reject) => {
      socket.on('connect', () => {
        assert.ok(socket.id);
        socket.disconnect();
        resolve();
      });
      socket.on('connect_error', reject);
    });
  });

  test('35. Invalid socket authentication rejected', async () => {
    const socket = ioClient(`http://localhost:${serverPort}`, {
      auth: { token: 'invalid_token_xyz' },
      transports: ['websocket'],
      forceNew: true,
    });

    await new Promise((resolve) => {
      socket.on('connect_error', (err) => {
        assert.ok(err.message.includes('Authentication error'));
        socket.disconnect();
        resolve();
      });
    });
  });

  test('36. Authorized user can join their own ticket room', async () => {
    const socket = ioClient(`http://localhost:${serverPort}`, {
      auth: { token: user1Token },
      transports: ['websocket'],
      forceNew: true,
    });

    await new Promise((resolve) => {
      socket.on('connect', () => {
        socket.emit('join:ticket', { ticketId: ticket1Id }, (response) => {
          assert.strictEqual(response.success, true);
          socket.disconnect();
          resolve();
        });
      });
    });
  });

  test('37. Unauthorized user cannot join another user’s ticket room', async () => {
    const socket = ioClient(`http://localhost:${serverPort}`, {
      auth: { token: user2Token }, // User 2 trying to join Ticket 1 (User 1's ticket)
      transports: ['websocket'],
      forceNew: true,
    });

    await new Promise((resolve) => {
      socket.on('connect', () => {
        socket.emit('join:ticket', { ticketId: ticket1Id }, (response) => {
          assert.strictEqual(response.success, false);
          assert.ok(response.message.includes('Forbidden') || response.message.includes('Not authorized'));
          socket.disconnect();
          resolve();
        });
      });
    });
  });

  test('38. Ticket status change emits real-time event to ticket room', async () => {
    const socket = ioClient(`http://localhost:${serverPort}`, {
      auth: { token: user1Token },
      transports: ['websocket'],
      forceNew: true,
    });

    await new Promise((resolve) => {
      socket.on('connect', () => {
        socket.emit('join:ticket', { ticketId: ticket1Id }, async () => {
          // Listen for status changed event
          socket.on('ticket:statusChanged', (payload) => {
            assert.strictEqual(payload.data.newStatus, 'Resolved');
            socket.disconnect();
            resolve();
          });

          // Trigger status transition via REST
          await request(app)
            .put(`/api/tickets/${ticket1Id}/status`)
            .set('Authorization', `Bearer ${agentToken}`)
            .send({ status: 'Resolved' });
        });
      });
    });
  });

  test('39. Comment creation emits real-time event to ticket room', async () => {
    const socket = ioClient(`http://localhost:${serverPort}`, {
      auth: { token: user1Token },
      transports: ['websocket'],
      forceNew: true,
    });

    await new Promise((resolve) => {
      socket.on('connect', () => {
        socket.emit('join:ticket', { ticketId: ticket1Id }, async () => {
          socket.on('comment:created', (payload) => {
            assert.strictEqual(payload.data.message, 'Real-time test message');
            socket.disconnect();
            resolve();
          });

          // Post comment via REST
          await request(app)
            .post(`/api/tickets/${ticket1Id}/comments`)
            .set('Authorization', `Bearer ${agentToken}`)
            .send({ message: 'Real-time test message' });
        });
      });
    });
  });

  test('40. Ticket assignment emits real-time event to ticket room', async () => {
    const socket = ioClient(`http://localhost:${serverPort}`, {
      auth: { token: user1Token },
      transports: ['websocket'],
      forceNew: true,
    });

    await new Promise((resolve) => {
      socket.on('connect', () => {
        socket.emit('join:ticket', { ticketId: ticket2Id }, async () => {
          socket.on('ticket:assigned', (payload) => {
            assert.strictEqual(payload.data.newAgent, 'Agent Support');
            socket.disconnect();
            resolve();
          });

          // Admin assigns ticket 2 to agent
          await request(app)
            .put(`/api/tickets/${ticket2Id}/assign`)
            .set('Authorization', `Bearer ${adminToken}`)
            .send({ agentId });
        });
      });
    });
  });

  test('41. Real-time notification event emitted to user personal room', async () => {
    const socket = ioClient(`http://localhost:${serverPort}`, {
      auth: { token: user2Token },
      transports: ['websocket'],
      forceNew: true,
    });

    await new Promise((resolve) => {
      socket.on('connect', async () => {
        socket.on('notification:new', (payload) => {
          assert.strictEqual(payload.data.type, 'TICKET_STATUS_CHANGED');
          socket.disconnect();
          resolve();
        });

        // Admin updates status of User 2's ticket (Ticket 3)
        await request(app)
          .put(`/api/tickets/${ticket3Id}/status`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ status: 'In Progress' });
      });
    });
  });
});
