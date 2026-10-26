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

describe('Phase 7 — Server-Side Search, Filtering, Sorting & Pagination Suite', () => {
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

    // Create User 1
    const u1 = await request(app).post('/api/auth/register').send({
      name: 'Search User One',
      email: 'search_user1@p7test.com',
      password: 'password123',
    });
    user1Token = u1.body.token;
    user1Id = u1.body.user._id;

    // Create User 2
    const u2 = await request(app).post('/api/auth/register').send({
      name: 'Search User Two',
      email: 'search_user2@p7test.com',
      password: 'password123',
    });
    user2Token = u2.body.token;
    user2Id = u2.body.user._id;

    // Create Agent
    const ag = await User.create({
      name: 'Search Agent',
      email: 'search_agent@p7test.com',
      password: 'password123',
      role: 'agent',
    });
    agentId = ag._id;
    const agLogin = await request(app).post('/api/auth/login').send({
      email: 'search_agent@p7test.com',
      password: 'password123',
    });
    agentToken = agLogin.body.token;

    // Create Admin
    const ad = await User.create({
      name: 'Search Admin',
      email: 'search_admin@p7test.com',
      password: 'password123',
      role: 'admin',
    });
    adminId = ad._id;
    const adLogin = await request(app).post('/api/auth/login').send({
      email: 'search_admin@p7test.com',
      password: 'password123',
    });
    adminToken = adLogin.body.token;

    // Populate dataset of 15 varied tickets to thoroughly test pagination, search, and filters
    const sampleTickets = [
      {
        ticketId: 'TKT-000001',
        title: 'VPN connection failure',
        description: 'Unable to connect to gateway from home office',
        category: 'Network',
        priority: 'High',
        status: 'Open',
        createdBy: user1Id,
        createdAt: new Date('2026-01-01T10:00:00Z'),
      },
      {
        ticketId: 'TKT-000002',
        title: 'Laptop screen flickering',
        description: 'Hardware issue with Dell laptop monitor',
        category: 'Hardware',
        priority: 'Medium',
        status: 'Assigned',
        createdBy: user1Id,
        assignedTo: agentId,
        createdAt: new Date('2026-01-02T10:00:00Z'),
      },
      {
        ticketId: 'TKT-000003',
        title: 'Invoice tax calculation error',
        description: 'Billing discrepancy on quarterly renewal invoice',
        category: 'Billing',
        priority: 'Low',
        status: 'In Progress',
        createdBy: user1Id,
        assignedTo: agentId,
        createdAt: new Date('2026-01-03T10:00:00Z'),
      },
      {
        ticketId: 'TKT-000004',
        title: 'Database connection pool exhausted',
        description: 'Critical backend timeout on customer portal',
        category: 'Technical Issue',
        priority: 'Critical',
        status: 'Open',
        createdBy: user1Id,
        createdAt: new Date('2026-01-04T10:00:00Z'),
      },
      {
        ticketId: 'TKT-000005',
        title: 'Password reset email not received',
        description: 'User locked out of corporate single sign-on',
        category: 'Account Issue',
        priority: 'High',
        status: 'Resolved',
        createdBy: user1Id,
        assignedTo: agentId,
        resolvedAt: new Date('2026-01-05T12:00:00Z'),
        createdAt: new Date('2026-01-05T10:00:00Z'),
      },
      {
        ticketId: 'TKT-000006',
        title: 'Printer paper jam in 3rd floor marketing',
        description: 'HP LaserJet paper feed roller broken',
        category: 'Hardware',
        priority: 'Low',
        status: 'Closed',
        createdBy: user1Id,
        closedAt: new Date('2026-01-06T15:00:00Z'),
        createdAt: new Date('2026-01-06T10:00:00Z'),
      },
      {
        ticketId: 'TKT-000007',
        title: 'Special characters [regex] test ticket',
        description: 'Testing regex injection safety with (.*+?^${}|[])',
        category: 'Software',
        priority: 'Medium',
        status: 'Open',
        createdBy: user1Id,
        createdAt: new Date('2026-01-07T10:00:00Z'),
      },
      {
        ticketId: 'TKT-000008',
        title: 'API rate limiting blocking webhook integration',
        description: 'Software development sandbox hitting limits',
        category: 'Software',
        priority: 'High',
        status: 'In Progress',
        createdBy: user1Id,
        assignedTo: agentId,
        createdAt: new Date('2026-01-08T10:00:00Z'),
      },
      {
        ticketId: 'TKT-000009',
        title: 'Firewall blocking outgoing SSH port 22',
        description: 'Network engineering access restricted',
        category: 'Network',
        priority: 'Critical',
        status: 'Assigned',
        createdBy: user1Id,
        assignedTo: agentId,
        createdAt: new Date('2026-01-09T10:00:00Z'),
      },
      {
        ticketId: 'TKT-000010',
        title: 'Monthly subscription refund request',
        description: 'Billing team charged duplicate license fee',
        category: 'Billing',
        priority: 'Low',
        status: 'Resolved',
        createdBy: user1Id,
        assignedTo: agentId,
        createdAt: new Date('2026-01-10T10:00:00Z'),
      },
      {
        ticketId: 'TKT-000011',
        title: 'User 1 Eleventh Ticket',
        description: 'Testing default 10-item pagination limit boundary',
        category: 'Other',
        priority: 'Medium',
        status: 'Open',
        createdBy: user1Id,
        createdAt: new Date('2026-01-11T10:00:00Z'),
      },
      // Tickets for User 2 (Testing RBAC cross-tenant isolation)
      {
        ticketId: 'TKT-000012',
        title: 'User 2 Network Failure',
        description: 'Different department network offline',
        category: 'Network',
        priority: 'Critical',
        status: 'Open',
        createdBy: user2Id,
        createdAt: new Date('2026-01-12T10:00:00Z'),
      },
      {
        ticketId: 'TKT-000013',
        title: 'User 2 Hardware Request',
        description: 'New monitor needed',
        category: 'Hardware',
        priority: 'Low',
        status: 'Assigned',
        createdBy: user2Id,
        assignedTo: agentId,
        createdAt: new Date('2026-01-13T10:00:00Z'),
      },
      {
        ticketId: 'TKT-000014',
        title: 'User 2 Billing Query',
        description: 'Credit card payment failed',
        category: 'Billing',
        priority: 'High',
        status: 'Open',
        createdBy: user2Id,
        createdAt: new Date('2026-01-14T10:00:00Z'),
      },
      {
        ticketId: 'TKT-000015',
        title: 'User 2 Account Permission Update',
        description: 'Role upgrade request for analyst',
        category: 'Account Issue',
        priority: 'Medium',
        status: 'Resolved',
        createdBy: user2Id,
        createdAt: new Date('2026-01-15T10:00:00Z'),
      },
    ];

    for (const t of sampleTickets) {
      await Ticket.create(t);
    }
  });

  after(async () => {
    await disconnectDB();
  });

  // ---------------------------------------------------------------------------
  // 1. PAGINATION & DEFAULT METADATA
  // ---------------------------------------------------------------------------
  test('1. Default pagination returns max 10 items with standardized metadata', async () => {
    const res = await request(app)
      .get('/api/tickets')
      .set('Authorization', `Bearer ${adminToken}`);

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.tickets.length, 10); // Default limit is 10
    assert.strictEqual(res.body.pagination.page, 1);
    assert.strictEqual(res.body.pagination.currentPage, 1);
    assert.strictEqual(res.body.pagination.limit, 10);
    assert.strictEqual(res.body.pagination.totalItems, 15);
    assert.strictEqual(res.body.pagination.totalPages, 2);
    assert.strictEqual(res.body.pagination.hasNextPage, true);
    assert.strictEqual(res.body.pagination.hasPreviousPage, false);
  });

  test('2. Page 2 returns the remaining 5 items', async () => {
    const res = await request(app)
      .get('/api/tickets?page=2&limit=10')
      .set('Authorization', `Bearer ${adminToken}`);

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.tickets.length, 5);
    assert.strictEqual(res.body.pagination.page, 2);
    assert.strictEqual(res.body.pagination.currentPage, 2);
    assert.strictEqual(res.body.pagination.hasNextPage, false);
    assert.strictEqual(res.body.pagination.hasPreviousPage, true);
  });

  test('3. Custom limit parameter slices records correctly', async () => {
    const res = await request(app)
      .get('/api/tickets?page=1&limit=5')
      .set('Authorization', `Bearer ${adminToken}`);

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.tickets.length, 5);
    assert.strictEqual(res.body.pagination.totalPages, 3);
  });

  test('4. Invalid pagination parameters are rejected with 400 Bad Request', async () => {
    const res1 = await request(app)
      .get('/api/tickets?page=0')
      .set('Authorization', `Bearer ${adminToken}`);
    assert.strictEqual(res1.status, 400);

    const res2 = await request(app)
      .get('/api/tickets?limit=150') // Exceeds max limit 100
      .set('Authorization', `Bearer ${adminToken}`);
    assert.strictEqual(res2.status, 400);
  });

  // ---------------------------------------------------------------------------
  // 2. SEARCH & REGEX INJECTION SAFETY
  // ---------------------------------------------------------------------------
  test('5. Search matches case-insensitively on ticket title', async () => {
    const res = await request(app)
      .get('/api/tickets?search=exhausted')
      .set('Authorization', `Bearer ${adminToken}`);

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.tickets.length, 1);
    assert.strictEqual(res.body.tickets[0].ticketId, 'TKT-000004');
  });

  test('6. Search matches on description keywords', async () => {
    const res = await request(app)
      .get('/api/tickets?search=single%20sign-on')
      .set('Authorization', `Bearer ${adminToken}`);

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.tickets.length, 1);
    assert.strictEqual(res.body.tickets[0].ticketId, 'TKT-000005');
  });

  test('7. Search handles regex special characters safely without injection or crash', async () => {
    const res = await request(app)
      .get('/api/tickets?search=[regex]')
      .set('Authorization', `Bearer ${adminToken}`);

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.tickets.length, 1);
    assert.strictEqual(res.body.tickets[0].ticketId, 'TKT-000007');
  });

  // ---------------------------------------------------------------------------
  // 3. FIELD FILTERS (STATUS, PRIORITY, CATEGORY, DATES)
  // ---------------------------------------------------------------------------
  test('8. Filter by status returns exact status matches', async () => {
    const res = await request(app)
      .get('/api/tickets?status=Resolved')
      .set('Authorization', `Bearer ${adminToken}`);

    assert.strictEqual(res.status, 200);
    assert.ok(res.body.tickets.length > 0);
    res.body.tickets.forEach((t) => assert.strictEqual(t.status, 'Resolved'));
  });

  test('9. Filter by priority returns exact priority matches', async () => {
    const res = await request(app)
      .get('/api/tickets?priority=Critical')
      .set('Authorization', `Bearer ${adminToken}`);

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.tickets.length, 3); // Tickets 4, 9, 12
    res.body.tickets.forEach((t) => assert.strictEqual(t.priority, 'Critical'));
  });

  test('10. Filter by category returns exact category matches', async () => {
    const res = await request(app)
      .get('/api/tickets?category=Billing')
      .set('Authorization', `Bearer ${adminToken}`);

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.tickets.length, 3); // Tickets 3, 10, 14
    res.body.tickets.forEach((t) => assert.strictEqual(t.category, 'Billing'));
  });

  test('11. Filter by date range (fromDate & toDate) isolates matching records', async () => {
    const res = await request(app)
      .get('/api/tickets?fromDate=2026-01-02&toDate=2026-01-04')
      .set('Authorization', `Bearer ${adminToken}`);

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.tickets.length, 3); // Tickets 2, 3, 4
  });

  test('12. Invalid fromDate parameter is rejected with 400 Bad Request', async () => {
    const res = await request(app)
      .get('/api/tickets?fromDate=not-a-valid-date')
      .set('Authorization', `Bearer ${adminToken}`);

    assert.strictEqual(res.status, 400);
    assert.strictEqual(res.body.success, false);
  });

  // ---------------------------------------------------------------------------
  // 4. SORTING
  // ---------------------------------------------------------------------------
  test('13. Sorting by sort=oldest returns earliest tickets first', async () => {
    const res = await request(app)
      .get('/api/tickets?sort=oldest')
      .set('Authorization', `Bearer ${adminToken}`);

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.tickets[0].ticketId, 'TKT-000001');
  });

  test('14. Sorting by sort=newest returns latest tickets first', async () => {
    const res = await request(app)
      .get('/api/tickets?sort=newest')
      .set('Authorization', `Bearer ${adminToken}`);

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.tickets[0].ticketId, 'TKT-000015');
  });

  test('15. Sorting by sort=priority_desc orders Critical/High first', async () => {
    const res = await request(app)
      .get('/api/tickets?sort=priority_desc')
      .set('Authorization', `Bearer ${adminToken}`);

    assert.strictEqual(res.status, 200);
    assert.ok(res.body.tickets.length > 0);
  });

  test('16. Unknown sort parameter safely falls back to default newest without error', async () => {
    const res = await request(app)
      .get('/api/tickets?sort=randomNonExistentSortField')
      .set('Authorization', `Bearer ${adminToken}`);

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.tickets[0].ticketId, 'TKT-000015'); // Defaults to newest
  });

  // ---------------------------------------------------------------------------
  // 5. COMBINED SEARCH, FILTER, SORT & PAGINATION
  // ---------------------------------------------------------------------------
  test('17. Complex combination of search, status, priority, category, sort and pagination', async () => {
    const res = await request(app)
      .get('/api/tickets?category=Network&status=Open&page=1&limit=5&sort=newest')
      .set('Authorization', `Bearer ${adminToken}`);

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.tickets.length, 2); // Ticket 1, Ticket 12
    assert.strictEqual(res.body.pagination.totalItems, 2);
    assert.strictEqual(res.body.tickets[0].ticketId, 'TKT-000012'); // Newest first
    assert.strictEqual(res.body.tickets[1].ticketId, 'TKT-000001');
  });

  // ---------------------------------------------------------------------------
  // 6. STRICT RBAC SCOPING PRECEDENCE
  // ---------------------------------------------------------------------------
  test('18. User 1 search & filter query only returns tickets created by User 1', async () => {
    // User 1 searches for 'Network' which exists in both User 1 and User 2 tickets
    const res = await request(app)
      .get('/api/tickets?search=Network')
      .set('Authorization', `Bearer ${user1Token}`);

    assert.strictEqual(res.status, 200);
    assert.ok(res.body.tickets.length > 0);
    res.body.tickets.forEach((t) => {
      assert.strictEqual(t.createdBy._id.toString(), user1Id.toString());
      assert.notStrictEqual(t.ticketId, 'TKT-000012'); // User 2's ticket must never appear
    });
  });

  test('19. Agent query only returns tickets assigned to that Agent', async () => {
    const res = await request(app)
      .get('/api/tickets?page=1&limit=20')
      .set('Authorization', `Bearer ${agentToken}`);

    assert.strictEqual(res.status, 200);
    assert.ok(res.body.tickets.length > 0);
    res.body.tickets.forEach((t) => {
      assert.strictEqual(t.assignedTo._id.toString(), agentId.toString());
    });
  });

  test('20. Admin query accesses global dataset across all users and agents', async () => {
    const res = await request(app)
      .get('/api/tickets?page=1&limit=20')
      .set('Authorization', `Bearer ${adminToken}`);

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.pagination.totalItems, 15);
    assert.strictEqual(res.body.tickets.length, 15);
  });
});
