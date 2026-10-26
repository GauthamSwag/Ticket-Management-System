const { test, describe, before, after } = require('node:test');
const assert = require('node:assert');
const request = require('supertest');
const mongoose = require('mongoose');
const { connectDB, disconnectDB } = require('../config/db');
const User = require('../models/User');

process.env.NODE_ENV = 'test';
process.env.MONGO_URI = 'memory';
process.env.JWT_SECRET = 'test_jwt_secret_key_12345';

let app;

describe('Authentication & RBAC API Suite', () => {
  let userToken;
  let adminToken;
  let userId;

  before(async () => {
    await connectDB();
    app = require('../server');
    await User.deleteMany({});
  });

  after(async () => {
    await disconnectDB();
  });

  test('1. Health check endpoint responds with 200 OK and online status', async () => {
    const res = await request(app).get('/api/health');
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.status, 'online');
  });

  test('2. User registration with valid data returns 201 and JWT token', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Regular Tester',
        email: 'tester@example.com',
        password: 'password123',
        department: 'Operations',
      });

    assert.strictEqual(res.status, 201);
    assert.strictEqual(res.body.success, true);
    assert.ok(res.body.token, 'Should return a JWT token');
    assert.strictEqual(res.body.user.email, 'tester@example.com');
    assert.strictEqual(res.body.user.role, 'user');
    assert.strictEqual(res.body.user.password, undefined, 'Password must not be returned');
    userId = res.body.user._id;
  });

  test('3. Registering duplicate email returns 400 Bad Request', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Duplicate Tester',
        email: 'tester@example.com',
        password: 'password123',
      });

    assert.strictEqual(res.status, 400);
    assert.strictEqual(res.body.success, false);
    assert.match(res.body.message, /already exists/i);
  });

  test('4. Registering with short password (< 6 chars) returns 400', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Short Pass',
        email: 'short@example.com',
        password: '123',
      });

    assert.strictEqual(res.status, 400);
    assert.strictEqual(res.body.success, false);
    assert.match(res.body.message, /at least 6 characters/i);
  });

  test('5. Login with valid credentials returns 200 and JWT token', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'tester@example.com',
        password: 'password123',
      });

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert.ok(res.body.token);
    assert.strictEqual(res.body.user.email, 'tester@example.com');
    userToken = res.body.token;
  });

  test('6. Login with incorrect password returns 401 Unauthorized', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'tester@example.com',
        password: 'wrongpassword',
      });

    assert.strictEqual(res.status, 401);
    assert.strictEqual(res.body.success, false);
    assert.match(res.body.message, /invalid email or password/i);
  });

  test('7. Protected route /api/auth/me rejects request without token with 401', async () => {
    const res = await request(app).get('/api/auth/me');
    assert.strictEqual(res.status, 401);
    assert.strictEqual(res.body.success, false);
  });

  test('8. Protected route /api/auth/me accepts valid Bearer token and returns user profile', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${userToken}`);

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.user.email, 'tester@example.com');
    assert.strictEqual(res.body.user.password, undefined);
  });

  test('9. Update profile endpoint updates user details successfully', async () => {
    const res = await request(app)
      .put('/api/auth/profile')
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        name: 'Regular Tester Updated',
        phone: '+1-555-9999',
      });

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.user.name, 'Regular Tester Updated');
    assert.strictEqual(res.body.user.phone, '+1-555-9999');
  });

  test('10. RBAC: Standard user is denied access (403) to Admin-only /api/auth/users', async () => {
    const res = await request(app)
      .get('/api/auth/users')
      .set('Authorization', `Bearer ${userToken}`);

    assert.strictEqual(res.status, 403);
    assert.strictEqual(res.body.success, false);
    assert.match(res.body.message, /Forbidden.*Role 'user' is not authorized/i);
  });

  test('11. RBAC: Admin user can register and access /api/auth/users with 200 OK', async () => {
    // Register admin user
    const adminReg = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Super Admin',
        email: 'admin@system.local',
        password: 'adminpassword123',
        role: 'admin',
      });

    assert.strictEqual(adminReg.status, 201);
    adminToken = adminReg.body.token;

    // Access admin endpoint
    const res = await request(app)
      .get('/api/auth/users')
      .set('Authorization', `Bearer ${adminToken}`);

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert.ok(Array.isArray(res.body.users));
    assert.ok(res.body.count >= 2);
  });
});
