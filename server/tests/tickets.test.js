const { test, describe, before, after } = require('node:test');
const assert = require('node:assert');
const request = require('supertest');
const mongoose = require('mongoose');
const { connectDB, disconnectDB } = require('../config/db');
const User = require('../models/User');
const Ticket = require('../models/Ticket');
const Counter = require('../models/Counter');

process.env.NODE_ENV = 'test';
process.env.MONGO_URI = 'memory';
process.env.JWT_SECRET = 'test_jwt_secret_key_12345';

let app;

describe('Phase 2 — Core Ticket Management Module Test Suite', () => {
  let user1Token, user1Id;
  let user2Token, user2Id;
  let agentToken, agentId;
  let adminToken, adminId;
  let ticketId1, customTicketId1;
  let ticketId2;

  before(async () => {
    await connectDB();
    app = require('../server');
    await User.deleteMany({});
    await Ticket.deleteMany({});
    await Counter.deleteMany({});

    // 1. Create User 1 (Alice)
    const u1Res = await request(app).post('/api/auth/register').send({
      name: 'Alice User',
      email: 'alice@example.com',
      password: 'password123',
      role: 'user',
      department: 'Marketing',
    });
    user1Token = u1Res.body.token;
    user1Id = u1Res.body.user._id;

    // 2. Create User 2 (Bob)
    const u2Res = await request(app).post('/api/auth/register').send({
      name: 'Bob User',
      email: 'bob@example.com',
      password: 'password123',
      role: 'user',
      department: 'Sales',
    });
    user2Token = u2Res.body.token;
    user2Id = u2Res.body.user._id;

    // 3. Create Agent (Charlie)
    const agRes = await request(app).post('/api/auth/register').send({
      name: 'Charlie Agent',
      email: 'charlie@example.com',
      password: 'password123',
      role: 'agent',
      department: 'Technical Support',
    });
    agentToken = agRes.body.token;
    agentId = agRes.body.user._id;

    // 4. Create Admin (Diana)
    const adRes = await request(app).post('/api/auth/register').send({
      name: 'Diana Admin',
      email: 'diana@example.com',
      password: 'password123',
      role: 'admin',
      department: 'Operations',
    });
    adminToken = adRes.body.token;
    adminId = adRes.body.user._id;
  });

  after(async () => {
    await disconnectDB();
  });

  test('1. User 1 can create a ticket with title, description, category, and priority', async () => {
    const res = await request(app)
      .post('/api/tickets')
      .set('Authorization', `Bearer ${user1Token}`)
      .send({
        title: 'Cannot access internal VPN from remote network',
        description: 'Receiving error code 800 when attempting to connect to the internal gateway.',
        category: 'Network',
        priority: 'High',
      });

    assert.strictEqual(res.status, 201);
    assert.strictEqual(res.body.success, true);
    assert.ok(res.body.ticket._id);
    assert.strictEqual(res.body.ticket.status, 'Open');
    assert.strictEqual(res.body.ticket.priority, 'High');
    assert.strictEqual(res.body.ticket.category, 'Network');
    assert.strictEqual(res.body.ticket.createdBy._id.toString(), user1Id.toString());

    ticketId1 = res.body.ticket._id;
    customTicketId1 = res.body.ticket.ticketId;
    assert.match(customTicketId1, /^TKT-\d{6}$/, 'Ticket ID should be in format TKT-000001');
  });

  test('2. Consecutively created ticket receives unique and sequential ticket ID', async () => {
    const res = await request(app)
      .post('/api/tickets')
      .set('Authorization', `Bearer ${user2Token}`)
      .send({
        title: 'Monitor flickering issue on HDMI port 2',
        description: 'Screen randomly goes black for 2 seconds while working in CAD tools.',
        category: 'Hardware',
        priority: 'Medium',
      });

    assert.strictEqual(res.status, 201);
    ticketId2 = res.body.ticket._id;
    const customTicketId2 = res.body.ticket.ticketId;

    assert.match(customTicketId2, /^TKT-\d{6}$/);
    assert.notStrictEqual(customTicketId1, customTicketId2, 'Ticket IDs must be unique');
  });

  test('3. Ticket creation validates required fields (title, description)', async () => {
    const res = await request(app)
      .post('/api/tickets')
      .set('Authorization', `Bearer ${user1Token}`)
      .send({
        title: '',
        description: '',
      });

    assert.strictEqual(res.status, 400);
    assert.strictEqual(res.body.success, false);
    assert.match(res.body.message, /provide both title and description/i);
  });

  test('4. User 1 retrieves only their own tickets', async () => {
    const res = await request(app)
      .get('/api/tickets')
      .set('Authorization', `Bearer ${user1Token}`);

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.count, 1);
    assert.strictEqual(res.body.tickets[0]._id.toString(), ticketId1.toString());
  });

  test('5. User 1 cannot access User 2’s ticket (returns 403 Forbidden)', async () => {
    const res = await request(app)
      .get(`/api/tickets/${ticketId2}`)
      .set('Authorization', `Bearer ${user1Token}`);

    assert.strictEqual(res.status, 403);
    assert.strictEqual(res.body.success, false);
    assert.match(res.body.message, /not authorized to view this ticket/i);
  });

  test('6. Unassigned Agent cannot view ticket before assignment (returns 403)', async () => {
    const res = await request(app)
      .get(`/api/tickets/${ticketId1}`)
      .set('Authorization', `Bearer ${agentToken}`);

    assert.strictEqual(res.status, 403);
    assert.strictEqual(res.body.success, false);
  });

  test('7. Admin can view any ticket and all tickets in system', async () => {
    const allRes = await request(app)
      .get('/api/tickets')
      .set('Authorization', `Bearer ${adminToken}`);

    assert.strictEqual(allRes.status, 200);
    assert.ok(allRes.body.count >= 2);

    const singleRes = await request(app)
      .get(`/api/tickets/${ticketId1}`)
      .set('Authorization', `Bearer ${adminToken}`);

    assert.strictEqual(singleRes.status, 200);
    assert.strictEqual(singleRes.body.ticket._id.toString(), ticketId1.toString());
  });

  test('8. Admin cannot assign ticket to a regular user (returns 400)', async () => {
    const res = await request(app)
      .put(`/api/tickets/${ticketId1}/assign`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ agentId: user2Id });

    assert.strictEqual(res.status, 400);
    assert.strictEqual(res.body.success, false);
    assert.match(res.body.message, /only be assigned to users with the 'agent' role/i);
  });

  test('9. Admin can assign ticket to valid Agent (status transitions to Assigned)', async () => {
    const res = await request(app)
      .put(`/api/tickets/${ticketId1}/assign`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ agentId: agentId });

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.ticket.assignedTo._id.toString(), agentId.toString());
    assert.strictEqual(res.body.ticket.status, 'Assigned');
  });

  test('10. Assigned Agent can now view the ticket in their assigned queue', async () => {
    const listRes = await request(app)
      .get('/api/tickets')
      .set('Authorization', `Bearer ${agentToken}`);

    assert.strictEqual(listRes.status, 200);
    assert.ok(listRes.body.tickets.some((t) => t._id.toString() === ticketId1.toString()));

    const singleRes = await request(app)
      .get(`/api/tickets/${ticketId1}`)
      .set('Authorization', `Bearer ${agentToken}`);

    assert.strictEqual(singleRes.status, 200);
    assert.strictEqual(singleRes.body.ticket._id.toString(), ticketId1.toString());
  });

  test('11. Agent cannot modify an unrelated ticket (ticket 2 is unassigned)', async () => {
    const res = await request(app)
      .put(`/api/tickets/${ticketId2}`)
      .set('Authorization', `Bearer ${agentToken}`)
      .send({ title: 'Unauthorized edit attempt' });

    assert.strictEqual(res.status, 403);
    assert.strictEqual(res.body.success, false);
  });

  test('12. Normal user cannot arbitrarily change workflow status (returns 403)', async () => {
    const res = await request(app)
      .put(`/api/tickets/${ticketId1}/status`)
      .set('Authorization', `Bearer ${user1Token}`)
      .send({ status: 'Closed' });

    assert.strictEqual(res.status, 403);
    assert.strictEqual(res.body.success, false);
    assert.match(res.body.message, /Forbidden.*Role 'user' is not authorized/i);
  });

  test('13. Agent transitions status from Assigned to In Progress', async () => {
    const res = await request(app)
      .put(`/api/tickets/${ticketId1}/status`)
      .set('Authorization', `Bearer ${agentToken}`)
      .send({ status: 'In Progress' });

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.ticket.status, 'In Progress');
  });

  test('14. Agent transitions status from In Progress to Resolved (sets resolvedAt)', async () => {
    const res = await request(app)
      .put(`/api/tickets/${ticketId1}/status`)
      .set('Authorization', `Bearer ${agentToken}`)
      .send({ status: 'Resolved' });

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.ticket.status, 'Resolved');
    assert.ok(res.body.ticket.resolvedAt, 'resolvedAt timestamp should be set');
  });

  test('15. Admin transitions status from Resolved to Closed (sets closedAt)', async () => {
    const res = await request(app)
      .put(`/api/tickets/${ticketId1}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'Closed' });

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.ticket.status, 'Closed');
    assert.ok(res.body.ticket.closedAt, 'closedAt timestamp should be set');
  });

  test('16. Priority update works for assigned Agent or Admin', async () => {
    const res = await request(app)
      .put(`/api/tickets/${ticketId1}/priority`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ priority: 'Critical' });

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.ticket.priority, 'Critical');
  });

  test('17. User cannot edit or delete their ticket once status is no longer Open', async () => {
    const editRes = await request(app)
      .put(`/api/tickets/${ticketId1}`)
      .set('Authorization', `Bearer ${user1Token}`)
      .send({ title: 'Attempt to edit closed ticket' });

    assert.strictEqual(editRes.status, 400);
    assert.match(editRes.body.message, /only open tickets can be modified/i);

    const delRes = await request(app)
      .delete(`/api/tickets/${ticketId1}`)
      .set('Authorization', `Bearer ${user1Token}`);

    assert.strictEqual(delRes.status, 400);
    assert.match(delRes.body.message, /only open tickets can be deleted/i);
  });

  test('18. User can delete their own Open ticket (Ticket 2)', async () => {
    const delRes = await request(app)
      .delete(`/api/tickets/${ticketId2}`)
      .set('Authorization', `Bearer ${user2Token}`);

    assert.strictEqual(delRes.status, 200);
    assert.strictEqual(delRes.body.success, true);

    const getRes = await request(app)
      .get(`/api/tickets/${ticketId2}`)
      .set('Authorization', `Bearer ${adminToken}`);

    assert.strictEqual(getRes.status, 404);
  });

  test('19. Ticket details never expose user password or password hash', async () => {
    const res = await request(app)
      .get(`/api/tickets/${ticketId1}`)
      .set('Authorization', `Bearer ${adminToken}`);

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.ticket.createdBy.password, undefined);
    assert.strictEqual(res.body.ticket.assignedTo.password, undefined);
  });

  test('20. Unauthorized request without JWT token returns 401', async () => {
    const res = await request(app).get('/api/tickets');
    assert.strictEqual(res.status, 401);
  });

  test('21. Non-existent ticket returns 404 Not Found', async () => {
    const dummyId = new mongoose.Types.ObjectId();
    const res = await request(app)
      .get(`/api/tickets/${dummyId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    assert.strictEqual(res.status, 404);
  });
});
