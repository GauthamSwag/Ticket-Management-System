const { test, describe, before, after } = require('node:test');
const assert = require('node:assert');
const request = require('supertest');
const { connectDB, disconnectDB } = require('../config/db');

process.env.NODE_ENV = 'test';
process.env.MONGO_URI = 'memory';
process.env.JWT_SECRET = 'test_jwt_secret_key_12345';

let app;
const User = require('../models/User');

describe('Phase 8 — Admin Management Module Suite', () => {
  let userToken, userId;
  let agentToken, agentId;
  let adminToken, adminId;
  let targetUserToken, targetUserId;

  before(async () => {
    await connectDB();
    app = require('../server');

    await User.deleteMany({});

    // 1. Regular User
    const uRes = await request(app).post('/api/auth/register').send({
      name: 'Regular Standard User',
      email: 'regular_user@p8test.com',
      password: 'password123',
      department: 'Finance',
    });
    userToken = uRes.body.token;
    userId = uRes.body.user._id;

    // 2. Support Agent
    const ag = await User.create({
      name: 'Tier 2 Agent',
      email: 'tier2_agent@p8test.com',
      password: 'password123',
      role: 'agent',
      department: 'Technical Support',
    });
    agentId = ag._id;
    const agLogin = await request(app).post('/api/auth/login').send({
      email: 'tier2_agent@p8test.com',
      password: 'password123',
    });
    agentToken = agLogin.body.token;

    // 3. System Admin
    const adm = await User.create({
      name: 'Primary Admin',
      email: 'primary_admin@p8test.com',
      password: 'password123',
      role: 'admin',
      department: 'Operations',
    });
    adminId = adm._id;
    const admLogin = await request(app).post('/api/auth/login').send({
      email: 'primary_admin@p8test.com',
      password: 'password123',
    });
    adminToken = admLogin.body.token;

    // 4. Target User for role/status changes
    const target = await request(app).post('/api/auth/register').send({
      name: 'Target Employee',
      email: 'target_employee@p8test.com',
      password: 'password123',
      department: 'Customer Success',
    });
    targetUserToken = target.body.token;
    targetUserId = target.body.user._id;
  });

  after(async () => {
    await disconnectDB();
  });

  // =========================================================================
  // 1. GET /api/auth/users Security & Authorization
  // =========================================================================
  test('1. GET /api/auth/users requires authentication (401 Unauthorized)', async () => {
    const res = await request(app).get('/api/auth/users');
    assert.strictEqual(res.status, 401);
    assert.strictEqual(res.body.success, false);
  });

  test('2. Regular user is blocked from GET /api/auth/users (403 Forbidden)', async () => {
    const res = await request(app)
      .get('/api/auth/users')
      .set('Authorization', `Bearer ${userToken}`);
    assert.strictEqual(res.status, 403);
    assert.strictEqual(res.body.success, false);
    assert.match(res.body.message, /Role 'user' is not authorized/i);
  });

  test('3. Support agent is blocked from GET /api/auth/users (403 Forbidden)', async () => {
    const res = await request(app)
      .get('/api/auth/users')
      .set('Authorization', `Bearer ${agentToken}`);
    assert.strictEqual(res.status, 403);
    assert.strictEqual(res.body.success, false);
    assert.match(res.body.message, /Role 'agent' is not authorized/i);
  });

  test('4. Admin accesses GET /api/auth/users with standardized pagination metadata', async () => {
    const res = await request(app)
      .get('/api/auth/users')
      .set('Authorization', `Bearer ${adminToken}`);

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert.ok(Array.isArray(res.body.users));
    assert.ok(res.body.count >= 4);
    assert.ok(res.body.pagination);
    assert.strictEqual(res.body.pagination.currentPage, 1);
    assert.strictEqual(typeof res.body.pagination.totalItems, 'number');
    assert.strictEqual(typeof res.body.pagination.totalPages, 'number');
  });

  // =========================================================================
  // 2. Search, Filtering, Pagination on GET /api/auth/users
  // =========================================================================
  test('5. Admin can search users by case-insensitive name, email, or department', async () => {
    // Search by partial department 'Cust'
    const res = await request(app)
      .get('/api/auth/users?search=customer')
      .set('Authorization', `Bearer ${adminToken}`);

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.count, 1);
    assert.strictEqual(res.body.users[0].name, 'Target Employee');
    assert.strictEqual(res.body.users[0].department, 'Customer Success');
  });

  test('6. Admin user search safely sanitizes regex special characters', async () => {
    const res = await request(app)
      .get('/api/auth/users?search=[.*+?^${}()|\\]')
      .set('Authorization', `Bearer ${adminToken}`);

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.count, 0); // No matching users, zero crash
  });

  test('7. Admin can filter users by role (e.g., role=agent)', async () => {
    const res = await request(app)
      .get('/api/auth/users?role=agent')
      .set('Authorization', `Bearer ${adminToken}`);

    assert.strictEqual(res.status, 200);
    assert.ok(res.body.count >= 1);
    res.body.users.forEach((u) => {
      assert.strictEqual(u.role, 'agent');
    });
  });

  test('8. Admin can filter users by active status (isActive=true)', async () => {
    const res = await request(app)
      .get('/api/auth/users?isActive=true')
      .set('Authorization', `Bearer ${adminToken}`);

    assert.strictEqual(res.status, 200);
    assert.ok(res.body.count >= 4);
    res.body.users.forEach((u) => {
      assert.strictEqual(u.isActive, true);
    });
  });

  test('9. Admin custom pagination slices user list correctly (limit=2, page=1 & page=2)', async () => {
    const p1 = await request(app)
      .get('/api/auth/users?page=1&limit=2')
      .set('Authorization', `Bearer ${adminToken}`);

    assert.strictEqual(p1.status, 200);
    assert.strictEqual(p1.body.users.length, 2);
    assert.strictEqual(p1.body.pagination.currentPage, 1);
    assert.strictEqual(p1.body.pagination.limit, 2);
    assert.strictEqual(p1.body.pagination.hasNextPage, true);

    const p2 = await request(app)
      .get('/api/auth/users?page=2&limit=2')
      .set('Authorization', `Bearer ${adminToken}`);

    assert.strictEqual(p2.status, 200);
    assert.strictEqual(p2.body.users.length, 2);
    assert.strictEqual(p2.body.pagination.currentPage, 2);
    assert.strictEqual(p2.body.pagination.hasPreviousPage, true);

    // Verify disjoint records
    assert.notStrictEqual(p1.body.users[0]._id, p2.body.users[0]._id);
  });

  test('10. Invalid pagination parameters return 400 Bad Request', async () => {
    const res1 = await request(app)
      .get('/api/auth/users?page=0')
      .set('Authorization', `Bearer ${adminToken}`);
    assert.strictEqual(res1.status, 400);

    const res2 = await request(app)
      .get('/api/auth/users?limit=150')
      .set('Authorization', `Bearer ${adminToken}`);
    assert.strictEqual(res2.status, 400);
  });

  // =========================================================================
  // 3. PUT /api/auth/users/:id/role Security & Execution
  // =========================================================================
  test('11. Non-admin user is blocked from updating role (403 Forbidden)', async () => {
    const res = await request(app)
      .put(`/api/auth/users/${targetUserId}/role`)
      .set('Authorization', `Bearer ${userToken}`)
      .send({ role: 'agent' });

    assert.strictEqual(res.status, 403);
    assert.strictEqual(res.body.success, false);
  });

  test('12. Support agent is blocked from updating role (403 Forbidden)', async () => {
    const res = await request(app)
      .put(`/api/auth/users/${targetUserId}/role`)
      .set('Authorization', `Bearer ${agentToken}`)
      .send({ role: 'admin' });

    assert.strictEqual(res.status, 403);
    assert.strictEqual(res.body.success, false);
  });

  test('13. Admin receives 400 Bad Request when providing an invalid role', async () => {
    const res = await request(app)
      .put(`/api/auth/users/${targetUserId}/role`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ role: 'superhero' });

    assert.strictEqual(res.status, 400);
    assert.strictEqual(res.body.success, false);
    assert.match(res.body.message, /Invalid role/i);
  });

  test('14. Admin receives 404 Not Found for non-existent user ID', async () => {
    const nonExistentId = '650000000000000000000000';
    const res = await request(app)
      .put(`/api/auth/users/${nonExistentId}/role`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ role: 'agent' });

    assert.strictEqual(res.status, 404);
    assert.strictEqual(res.body.success, false);
  });

  test('15. Admin successfully updates target user role from "user" to "agent"', async () => {
    const res = await request(app)
      .put(`/api/auth/users/${targetUserId}/role`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ role: 'agent' });

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.user.role, 'agent');

    // Verify in database
    const dbUser = await User.findById(targetUserId);
    assert.strictEqual(dbUser.role, 'agent');
  });

  test('16. Admin is prevented (400 Bad Request) from demoting their own admin account', async () => {
    const res = await request(app)
      .put(`/api/auth/users/${adminId}/role`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ role: 'user' });

    assert.strictEqual(res.status, 400);
    assert.strictEqual(res.body.success, false);
    assert.match(res.body.message, /Administrators cannot demote their own account/i);

    // Verify admin remained admin
    const dbAdmin = await User.findById(adminId);
    assert.strictEqual(dbAdmin.role, 'admin');
  });

  // =========================================================================
  // 4. PUT /api/auth/users/:id/status Security & Execution
  // =========================================================================
  test('17. Non-admin user is blocked from modifying user status (403 Forbidden)', async () => {
    const res = await request(app)
      .put(`/api/auth/users/${targetUserId}/status`)
      .set('Authorization', `Bearer ${userToken}`)
      .send({ isActive: false });

    assert.strictEqual(res.status, 403);
    assert.strictEqual(res.body.success, false);
  });

  test('18. Support agent is blocked from modifying user status (403 Forbidden)', async () => {
    const res = await request(app)
      .put(`/api/auth/users/${targetUserId}/status`)
      .set('Authorization', `Bearer ${agentToken}`)
      .send({ isActive: false });

    assert.strictEqual(res.status, 403);
    assert.strictEqual(res.body.success, false);
  });

  test('19. Admin receives 404 Not Found when updating status of non-existent user ID', async () => {
    const nonExistentId = '650000000000000000000000';
    const res = await request(app)
      .put(`/api/auth/users/${nonExistentId}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ isActive: false });

    assert.strictEqual(res.status, 404);
    assert.strictEqual(res.body.success, false);
  });

  test('20. Admin can successfully deactivate target user account', async () => {
    const res = await request(app)
      .put(`/api/auth/users/${targetUserId}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ isActive: false });

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.user.isActive, false);

    // Verify in database
    const dbUser = await User.findById(targetUserId);
    assert.strictEqual(dbUser.isActive, false);
  });

  test('21. Deactivated user cannot log in (403 Forbidden)', async () => {
    const loginRes = await request(app).post('/api/auth/login').send({
      email: 'target_employee@p8test.com',
      password: 'password123',
    });

    assert.strictEqual(loginRes.status, 403);
    assert.strictEqual(loginRes.body.success, false);
    assert.match(loginRes.body.message, /account has been deactivated/i);
  });

  test('22. Admin can successfully reactivate the target user account', async () => {
    const res = await request(app)
      .put(`/api/auth/users/${targetUserId}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ isActive: true });

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.user.isActive, true);

    // Verify reactivated user can log in again
    const loginRes = await request(app).post('/api/auth/login').send({
      email: 'target_employee@p8test.com',
      password: 'password123',
    });
    assert.strictEqual(loginRes.status, 200);
    assert.strictEqual(loginRes.body.success, true);
  });

  test('23. Admin is prevented (400 Bad Request) from deactivating their own admin account', async () => {
    const res = await request(app)
      .put(`/api/auth/users/${adminId}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ isActive: false });

    assert.strictEqual(res.status, 400);
    assert.strictEqual(res.body.success, false);
    assert.match(res.body.message, /Administrators cannot deactivate their own account/i);

    // Verify admin remains active
    const dbAdmin = await User.findById(adminId);
    assert.strictEqual(dbAdmin.isActive, true);
  });
});
