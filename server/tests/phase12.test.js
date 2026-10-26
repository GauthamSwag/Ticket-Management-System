const { test, describe, before, after } = require('node:test');
const assert = require('node:assert');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const { connectDB, disconnectDB } = require('../config/db');

process.env.NODE_ENV = 'test';
process.env.MONGO_URI = 'memory';
process.env.JWT_SECRET = 'phase12_validation_and_error_handling_test_secret_key';
process.env.CLIENT_URL = 'http://localhost:3000';
process.env.EMAIL_NOTIFICATIONS_ENABLED = 'false';

let app;
const User = require('../models/User');
const Ticket = require('../models/Ticket');
const Comment = require('../models/Comment');
const Notification = require('../models/Notification');

describe('Phase 12 — Input Validation, Error Handling & Malformed Request Resiliency Suite', () => {
  let adminUser, adminToken;
  let normalUser, userToken;
  let testTicket;

  before(async () => {
    await connectDB();
    app = require('../server');

    await User.deleteMany({});
    await Ticket.deleteMany({});
    await Comment.deleteMany({});
    await Notification.deleteMany({});

    // 1. Seed Admin User
    adminUser = await User.create({
      name: 'Validation Admin',
      email: 'val_admin@phase12.com',
      password: 'AdminPassword123!',
      role: 'admin',
      department: 'Engineering',
    });
    adminToken = jwt.sign({ id: adminUser._id }, process.env.JWT_SECRET, { expiresIn: '1h' });

    // 2. Seed Normal User
    normalUser = await User.create({
      name: 'Validation User',
      email: 'val_user@phase12.com',
      password: 'UserPassword123!',
      role: 'user',
      department: 'Support',
    });
    userToken = jwt.sign({ id: normalUser._id }, process.env.JWT_SECRET, { expiresIn: '1h' });

    // 3. Seed A Valid Test Ticket
    testTicket = await Ticket.create({
      title: 'Valid Base Ticket for Phase 12 Tests',
      description: 'Used as an invariant reference across validation checks.',
      category: 'Software',
      priority: 'Medium',
      status: 'Open',
      createdBy: normalUser._id,
    });
  });

  after(async () => {
    await disconnectDB();
  });

  // ---------------------------------------------------------------------------
  // 1. MALFORMED JSON & SYNTAX ERROR RESILIENCY
  // ---------------------------------------------------------------------------
  test('1. Malformed JSON payload to POST /api/tickets returns 400 Bad Request without server crash', async () => {
    const res = await request(app)
      .post('/api/tickets')
      .set('Authorization', `Bearer ${userToken}`)
      .set('Content-Type', 'application/json')
      .send('{"title": "Broken JSON Syntax", "description": '); // Corrupted syntax

    assert.strictEqual(res.status, 400);
    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.message, 'Invalid JSON payload format.');
    assert.strictEqual(res.body.stack, undefined, 'Stack trace must not be leaked');

    // Verify Node server process is healthy and operational after malformed payload
    const healthRes = await request(app).get('/api/health');
    assert.strictEqual(healthRes.status, 200);
    assert.strictEqual(healthRes.body.status, 'online');
  });

  test('2. Malformed JSON payload to POST /api/auth/login returns 400 Bad Request cleanly', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .set('Content-Type', 'application/json')
      .send('{ email: "unquoted_key@example.com", broken: ');

    assert.strictEqual(res.status, 400);
    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.message, 'Invalid JSON payload format.');
  });

  // ---------------------------------------------------------------------------
  // 2. INVALID ENUM VALIDATION
  // ---------------------------------------------------------------------------
  test('3. Ticket creation with invalid priority (e.g. "SuperCritical") returns 400 Bad Request', async () => {
    const res = await request(app)
      .post('/api/tickets')
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        title: 'Emergency Server Overheat',
        description: 'Server room cooling failed completely',
        category: 'Hardware',
        priority: 'SuperCritical', // Invalid priority enum
      });

    assert.strictEqual(res.status, 400);
    assert.strictEqual(res.body.success, false);
    assert.match(res.body.message, /invalid priority/i);
    assert.match(res.body.message, /Supported priorities/i);
  });

  test('4. Ticket creation with invalid category (e.g. "Quantum Computing") returns 400 Bad Request', async () => {
    const res = await request(app)
      .post('/api/tickets')
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        title: 'Qubit Entanglement Failure',
        description: 'Quantum state decoherence observed in lab 3',
        category: 'Quantum Computing', // Invalid category enum
        priority: 'High',
      });

    assert.strictEqual(res.status, 400);
    assert.strictEqual(res.body.success, false);
    assert.match(res.body.message, /invalid category/i);
    assert.match(res.body.message, /Supported categories/i);
  });

  test('5. Ticket update with invalid category or priority returns 400 Bad Request', async () => {
    const catRes = await request(app)
      .put(`/api/tickets/${testTicket._id}`)
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        category: 'NonExistentCategory',
      });

    assert.strictEqual(catRes.status, 400);
    assert.strictEqual(catRes.body.success, false);
    assert.match(catRes.body.message, /invalid category/i);

    const prioRes = await request(app)
      .put(`/api/tickets/${testTicket._id}`)
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        priority: 'UltraUrgent',
      });

    assert.strictEqual(prioRes.status, 400);
    assert.strictEqual(prioRes.body.success, false);
    assert.match(prioRes.body.message, /invalid priority/i);
  });

  // ---------------------------------------------------------------------------
  // 3. PAGINATION BOUNDARY VALIDATION
  // ---------------------------------------------------------------------------
  test('6. GET /api/tickets?page=0&limit=500 rejects out-of-bounds parameters with 400 Bad Request', async () => {
    const res = await request(app)
      .get('/api/tickets?page=0&limit=500')
      .set('Authorization', `Bearer ${userToken}`);

    assert.strictEqual(res.status, 400);
    assert.strictEqual(res.body.success, false);
    assert.match(res.body.message, /invalid page number/i);
  });

  test('7. GET /api/tickets rejects limit > 100 with 400 Bad Request', async () => {
    const res = await request(app)
      .get('/api/tickets?page=1&limit=500')
      .set('Authorization', `Bearer ${userToken}`);

    assert.strictEqual(res.status, 400);
    assert.strictEqual(res.body.success, false);
    assert.match(res.body.message, /invalid limit parameter/i);
  });

  test('8. GET /api/tickets rejects negative page or negative limit with 400 Bad Request', async () => {
    const negPageRes = await request(app)
      .get('/api/tickets?page=-5&limit=10')
      .set('Authorization', `Bearer ${userToken}`);

    assert.strictEqual(negPageRes.status, 400);
    assert.strictEqual(negPageRes.body.success, false);

    const negLimitRes = await request(app)
      .get('/api/tickets?page=1&limit=-20')
      .set('Authorization', `Bearer ${userToken}`);

    assert.strictEqual(negLimitRes.status, 400);
    assert.strictEqual(negLimitRes.body.success, false);
  });

  // ---------------------------------------------------------------------------
  // 4. MISSING REQUIRED FIELDS & STRING VALIDATION
  // ---------------------------------------------------------------------------
  test('9. Missing required field "title" returns 400 Bad Request', async () => {
    const res = await request(app)
      .post('/api/tickets')
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        description: 'Description without a title',
        category: 'Software',
        priority: 'Low',
      });

    assert.strictEqual(res.status, 400);
    assert.strictEqual(res.body.success, false);
    assert.match(res.body.message, /provide both title and description/i);
  });

  test('10. Missing required field "description" returns 400 Bad Request', async () => {
    const res = await request(app)
      .post('/api/tickets')
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        title: 'Title without a description',
        category: 'Software',
        priority: 'Low',
      });

    assert.strictEqual(res.status, 400);
    assert.strictEqual(res.body.success, false);
    assert.match(res.body.message, /provide both title and description/i);
  });

  test('11. Empty whitespace-only "title" or "description" returns 400 Bad Request', async () => {
    const whitespaceTitleRes = await request(app)
      .post('/api/tickets')
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        title: '      ',
        description: 'Valid description content here',
      });

    assert.strictEqual(whitespaceTitleRes.status, 400);
    assert.strictEqual(whitespaceTitleRes.body.success, false);

    const whitespaceDescRes = await request(app)
      .post('/api/tickets')
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        title: 'Valid Title Here',
        description: '      ',
      });

    assert.strictEqual(whitespaceDescRes.status, 400);
    assert.strictEqual(whitespaceDescRes.body.success, false);
  });

  test('12. Registration with missing or non-string credentials returns 400 Bad Request', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Type Tester',
        email: 'typetester@phase12.com',
        password: 123456, // Non-string password
      });

    assert.strictEqual(res.status, 400);
    assert.strictEqual(res.body.success, false);
    assert.match(res.body.message, /provide name, email, and password/i);
  });

  // ---------------------------------------------------------------------------
  // 5. MONGOOSE CASTEROR HANDLING & OBJECTID VALIDATION
  // ---------------------------------------------------------------------------
  test('13. Malformed ObjectId in /api/tickets/not-a-valid-mongo-id catches CastError and returns 400 Bad Request', async () => {
    const res = await request(app)
      .get('/api/tickets/not-a-valid-mongo-id')
      .set('Authorization', `Bearer ${userToken}`);

    assert.strictEqual(res.status, 400);
    assert.strictEqual(res.body.success, false);
    assert.match(res.body.message, /Invalid resource ID format/i);
    assert.match(res.body.message, /24-character hexadecimal string/i);
  });

  test('14. Malformed ObjectId in ticket comments endpoint returns 400 Bad Request', async () => {
    const res = await request(app)
      .get('/api/tickets/malformed-id-123/comments')
      .set('Authorization', `Bearer ${userToken}`);

    assert.strictEqual(res.status, 400);
    assert.strictEqual(res.body.success, false);
    assert.match(res.body.message, /Invalid resource ID format/i);
  });

  test('15. Malformed ObjectId in admin user role update endpoint returns 400 Bad Request', async () => {
    const res = await request(app)
      .put('/api/auth/users/not-a-valid-mongo-id/role')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ role: 'agent' });

    assert.strictEqual(res.status, 400);
    assert.strictEqual(res.body.success, false);
    assert.match(res.body.message, /Invalid resource ID format/i);
  });

  test('16. Malformed ObjectId in notification read endpoint returns 400 Bad Request', async () => {
    const res = await request(app)
      .put('/api/notifications/invalid-mongo-id/read')
      .set('Authorization', `Bearer ${userToken}`);

    assert.strictEqual(res.status, 400);
    assert.strictEqual(res.body.success, false);
    assert.match(res.body.message, /Invalid resource ID format/i);
  });

  // ---------------------------------------------------------------------------
  // 6. PARAMETER & DATE BOUNDARY VALIDATION
  // ---------------------------------------------------------------------------
  test('17. Invalid date strings in fromDate / toDate query return 400 Bad Request', async () => {
    const resFrom = await request(app)
      .get('/api/tickets?fromDate=invalid-date-string')
      .set('Authorization', `Bearer ${userToken}`);

    assert.strictEqual(resFrom.status, 400);
    assert.strictEqual(resFrom.body.success, false);
    assert.match(resFrom.body.message, /invalid fromdate/i);

    const resTo = await request(app)
      .get('/api/tickets?toDate=not-a-calendar-date')
      .set('Authorization', `Bearer ${userToken}`);

    assert.strictEqual(resTo.status, 400);
    assert.strictEqual(resTo.body.success, false);
    assert.match(resTo.body.message, /invalid todate/i);
  });

  test('18. Invalid filter enum query parameters return 400 Bad Request', async () => {
    const resStatus = await request(app)
      .get('/api/tickets?status=NonExistentStatus')
      .set('Authorization', `Bearer ${userToken}`);

    assert.strictEqual(resStatus.status, 400);
    assert.strictEqual(resStatus.body.success, false);
    assert.match(resStatus.body.message, /invalid status parameter/i);

    const resPriority = await request(app)
      .get('/api/tickets?priority=UltraUrgent')
      .set('Authorization', `Bearer ${userToken}`);

    assert.strictEqual(resPriority.status, 400);
    assert.strictEqual(resPriority.body.success, false);
    assert.match(resPriority.body.message, /invalid priority parameter/i);

    const resCategory = await request(app)
      .get('/api/tickets?category=UnknownCategory')
      .set('Authorization', `Bearer ${userToken}`);

    assert.strictEqual(resCategory.status, 400);
    assert.strictEqual(resCategory.body.success, false);
    assert.match(resCategory.body.message, /invalid category parameter/i);
  });

  // ---------------------------------------------------------------------------
  // 7. CENTRALIZED ERROR RESPONSE STANDARDIZATION
  // ---------------------------------------------------------------------------
  test('19. Centralized error responses strictly conform to standard JSON contract without leaking stack trace', async () => {
    const res = await request(app)
      .get('/api/tickets/invalid-id-for-contract')
      .set('Authorization', `Bearer ${userToken}`);

    assert.strictEqual(res.status, 400);
    assert.strictEqual(typeof res.body.success, 'boolean');
    assert.strictEqual(res.body.success, false);
    assert.strictEqual(typeof res.body.message, 'string');
    assert.strictEqual(res.body.stack, undefined, 'Stack trace must not be exposed');
  });
});
