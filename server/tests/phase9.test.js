const { test, describe, before, after } = require('node:test');
const assert = require('node:assert');
const request = require('supertest');
const { connectDB, disconnectDB } = require('../config/db');

process.env.NODE_ENV = 'test';
process.env.MONGO_URI = 'memory';
process.env.JWT_SECRET = 'test_jwt_secret_key_phase9';
process.env.EMAIL_NOTIFICATIONS_ENABLED = 'false';

let app;
const User = require('../models/User');
const Ticket = require('../models/Ticket');
const Notification = require('../models/Notification');
const Comment = require('../models/Comment');

describe('Phase 9 — In-App Notification System & Lifecycle Integration Suite', () => {
  let userToken, userId;
  let agentToken, agentId;
  let adminToken, adminId;
  let secondUserToken, secondUserId;

  let testTicket;
  let sampleNotificationId;

  before(async () => {
    await connectDB();
    app = require('../server');

    await User.deleteMany({});
    await Ticket.deleteMany({});
    await Notification.deleteMany({});
    await Comment.deleteMany({});

    // 1. Regular User
    const uRes = await request(app).post('/api/auth/register').send({
      name: 'Notification EndUser',
      email: 'enduser@p9test.com',
      password: 'password123',
      department: 'Support',
    });
    userToken = uRes.body.token;
    userId = uRes.body.user._id;

    // 2. Second User
    const u2Res = await request(app).post('/api/auth/register').send({
      name: 'Second EndUser',
      email: 'seconduser@p9test.com',
      password: 'password123',
      department: 'HR',
    });
    secondUserToken = u2Res.body.token;
    secondUserId = u2Res.body.user._id;

    // 3. Support Agent
    const ag = await User.create({
      name: 'Assigned Agent 007',
      email: 'agent007@p9test.com',
      password: 'password123',
      role: 'agent',
      department: 'Technical Support',
    });
    agentId = ag._id;
    const agLogin = await request(app).post('/api/auth/login').send({
      email: 'agent007@p9test.com',
      password: 'password123',
    });
    agentToken = agLogin.body.token;

    // 4. System Admin
    const adm = await User.create({
      name: 'Master Admin',
      email: 'masteradmin@p9test.com',
      password: 'password123',
      role: 'admin',
      department: 'IT Operations',
    });
    adminId = adm._id;
    const admLogin = await request(app).post('/api/auth/login').send({
      email: 'masteradmin@p9test.com',
      password: 'password123',
    });
    adminToken = admLogin.body.token;
  });

  after(async () => {
    await disconnectDB();
  });

  // =========================================================================
  // SECTION 1: ENDPOINT SECURITY & AUTHENTICATION
  // =========================================================================

  test('1. GET /api/notifications rejects unauthenticated requests with 401', async () => {
    const res = await request(app).get('/api/notifications');
    assert.strictEqual(res.status, 401);
  });

  test('2. GET /api/notifications/unread-count rejects unauthenticated requests with 401', async () => {
    const res = await request(app).get('/api/notifications/unread-count');
    assert.strictEqual(res.status, 401);
  });

  test('3. PUT /api/notifications/:id/read rejects unauthenticated requests with 401', async () => {
    const res = await request(app).put('/api/notifications/64b1f2e4f0123456789abcde/read');
    assert.strictEqual(res.status, 401);
  });

  test('4. PUT /api/notifications/read-all rejects unauthenticated requests with 401', async () => {
    const res = await request(app).put('/api/notifications/read-all');
    assert.strictEqual(res.status, 401);
  });

  // =========================================================================
  // SECTION 2: NOTIFICATION CREATION, PAGINATION & METADATA
  // =========================================================================

  test('5. Seed sample notifications for testing user and verify isolated list', async () => {
    // Create notifications for regular user
    const n1 = await Notification.create({
      recipient: userId,
      type: 'TICKET_STATUS_CHANGED',
      title: 'Ticket #1 Status Changed',
      message: 'Status was moved to in-progress',
      isRead: false,
    });
    sampleNotificationId = n1._id.toString();

    await Notification.create({
      recipient: userId,
      type: 'TICKET_COMMENT',
      title: 'New Comment on Ticket #1',
      message: 'Agent responded to your question',
      isRead: false,
    });

    await Notification.create({
      recipient: userId,
      type: 'TICKET_ASSIGNED',
      title: 'Ticket #1 Assigned',
      message: 'Agent 007 assigned',
      isRead: true,
    });

    // Create a notification for second user (should NOT be visible to regular user)
    await Notification.create({
      recipient: secondUserId,
      type: 'TICKET_CREATED',
      title: 'Second user notification',
      message: 'Should never leak to first user',
      isRead: false,
    });

    const res = await request(app)
      .get('/api/notifications')
      .set('Authorization', `Bearer ${userToken}`);

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.total, 3);
    assert.strictEqual(res.body.notifications.length, 3);

    // Verify all returned notifications belong to the requesting user
    res.body.notifications.forEach((n) => {
      assert.strictEqual(n.recipient.toString(), userId.toString());
    });
  });

  test('6. Standardized pagination metadata is returned with page and limit queries', async () => {
    const res = await request(app)
      .get('/api/notifications?page=1&limit=2')
      .set('Authorization', `Bearer ${userToken}`);

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.notifications.length, 2);
    assert.ok(res.body.pagination);
    assert.strictEqual(res.body.pagination.totalItems, 3);
    assert.strictEqual(res.body.pagination.totalPages, 2);
    assert.strictEqual(res.body.pagination.currentPage, 1);
    assert.strictEqual(res.body.pagination.hasNextPage, true);
    assert.strictEqual(res.body.pagination.hasPreviousPage, false);
  });

  test('7. Filter by isRead query parameter (unread vs read)', async () => {
    // Unread only
    const unreadRes = await request(app)
      .get('/api/notifications?isRead=false')
      .set('Authorization', `Bearer ${userToken}`);

    assert.strictEqual(unreadRes.status, 200);
    assert.strictEqual(unreadRes.body.notifications.length, 2);
    unreadRes.body.notifications.forEach((n) => assert.strictEqual(n.isRead, false));

    // Read only
    const readRes = await request(app)
      .get('/api/notifications?isRead=true')
      .set('Authorization', `Bearer ${userToken}`);

    assert.strictEqual(readRes.status, 200);
    assert.strictEqual(readRes.body.notifications.length, 1);
    assert.strictEqual(readRes.body.notifications[0].isRead, true);
  });

  test('8. Filter by notification type query parameter', async () => {
    const typeRes = await request(app)
      .get('/api/notifications?type=TICKET_COMMENT')
      .set('Authorization', `Bearer ${userToken}`);

    assert.strictEqual(typeRes.status, 200);
    assert.strictEqual(typeRes.body.notifications.length, 1);
    assert.strictEqual(typeRes.body.notifications[0].type, 'TICKET_COMMENT');
  });

  test('9. Pagination parameter validation rejects invalid page and limit with 400', async () => {
    const badPage = await request(app)
      .get('/api/notifications?page=0')
      .set('Authorization', `Bearer ${userToken}`);
    assert.strictEqual(badPage.status, 400);

    const badLimit = await request(app)
      .get('/api/notifications?limit=200')
      .set('Authorization', `Bearer ${userToken}`);
    assert.strictEqual(badLimit.status, 400);
  });

  // =========================================================================
  // SECTION 3: UNREAD COUNT ENDPOINT
  // =========================================================================

  test('10. GET /api/notifications/unread-count returns accurate integer count', async () => {
    const res = await request(app)
      .get('/api/notifications/unread-count')
      .set('Authorization', `Bearer ${userToken}`);

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert.strictEqual(typeof res.body.count, 'number');
    assert.strictEqual(res.body.count, 2);
  });

  // =========================================================================
  // SECTION 4: MARK AS READ (SINGLE & ALL) & DELETION
  // =========================================================================

  test('11. PUT /api/notifications/:id/read marks single notification as read', async () => {
    const res = await request(app)
      .put(`/api/notifications/${sampleNotificationId}/read`)
      .set('Authorization', `Bearer ${userToken}`);

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.notification.isRead, true);

    // Verify unread count decremented to 1
    const countRes = await request(app)
      .get('/api/notifications/unread-count')
      .set('Authorization', `Bearer ${userToken}`);
    assert.strictEqual(countRes.body.count, 1);
  });

  test('12. User cannot mark another user notification as read (403 Forbidden)', async () => {
    const res = await request(app)
      .put(`/api/notifications/${sampleNotificationId}/read`)
      .set('Authorization', `Bearer ${secondUserToken}`);

    assert.strictEqual(res.status, 403);
  });

  test('13. PUT /api/notifications/:id/read returns 404 for non-existent ID', async () => {
    const res = await request(app)
      .put('/api/notifications/64b1f2e4f0123456789abcde/read')
      .set('Authorization', `Bearer ${userToken}`);

    assert.strictEqual(res.status, 404);
  });

  test('14. PUT /api/notifications/read-all marks all unread notifications as read', async () => {
    const res = await request(app)
      .put('/api/notifications/read-all')
      .set('Authorization', `Bearer ${userToken}`);

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert.ok(res.body.modifiedCount >= 1);

    // Verify unread count is now 0 for this user
    const countRes = await request(app)
      .get('/api/notifications/unread-count')
      .set('Authorization', `Bearer ${userToken}`);
    assert.strictEqual(countRes.body.count, 0);

    // Verify second user unread count was NOT impacted
    const u2Count = await request(app)
      .get('/api/notifications/unread-count')
      .set('Authorization', `Bearer ${secondUserToken}`);
    assert.strictEqual(u2Count.body.count, 1);
  });

  test('15. DELETE /api/notifications/:id deletes notification successfully', async () => {
    const res = await request(app)
      .delete(`/api/notifications/${sampleNotificationId}`)
      .set('Authorization', `Bearer ${userToken}`);

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);

    const check = await Notification.findById(sampleNotificationId);
    assert.strictEqual(check, null);
  });

  // =========================================================================
  // SECTION 5: LIFECYCLE EVENT NOTIFICATION DISPATCH
  // =========================================================================

  test('16. Ticket creation automatically dispatches notification for Admins', async () => {
    const initialAdminUnread = await Notification.countDocuments({
      recipient: adminId,
      isRead: false,
    });

    const createRes = await request(app)
      .post('/api/tickets')
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        title: 'Phase 9 Lifecycle Test Ticket',
        description: 'Testing end-to-end notification generation on ticket creation.',
        category: 'Hardware',
        priority: 'High',
      });

    assert.strictEqual(createRes.status, 201);
    testTicket = createRes.body.ticket;

    // Check that Admin received a TICKET_CREATED notification
    const adminNotif = await Notification.findOne({
      recipient: adminId,
      type: 'TICKET_CREATED',
      ticket: testTicket._id,
    });

    assert.ok(adminNotif, 'Admin notification should have been generated');
    assert.ok(adminNotif.title.includes(testTicket.ticketId));
    assert.strictEqual(adminNotif.isRead, false);
  });

  test('17. Ticket assignment automatically generates notification for assigned Agent', async () => {
    const assignRes = await request(app)
      .put(`/api/tickets/${testTicket._id}/assign`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ agentId });

    assert.strictEqual(assignRes.status, 200);

    const agentNotif = await Notification.findOne({
      recipient: agentId,
      type: 'TICKET_ASSIGNED',
      ticket: testTicket._id,
    });

    assert.ok(agentNotif, 'Agent notification should have been generated');
    assert.strictEqual(agentNotif.recipient.toString(), agentId.toString());
    assert.ok(agentNotif.message.includes('assigned'));
  });

  test('18. Status update automatically notifies ticket creator', async () => {
    const statusRes = await request(app)
      .put(`/api/tickets/${testTicket._id}/status`)
      .set('Authorization', `Bearer ${agentToken}`)
      .send({ status: 'In Progress' });

    assert.strictEqual(statusRes.status, 200);

    const creatorNotif = await Notification.findOne({
      recipient: userId,
      type: 'TICKET_STATUS_CHANGED',
      ticket: testTicket._id,
    });

    assert.ok(creatorNotif, 'Creator should receive status update notification');
    assert.ok(creatorNotif.message.includes('In Progress'));
  });

  test('19. Priority update generates notification for ticket creator', async () => {
    const priorityRes = await request(app)
      .put(`/api/tickets/${testTicket._id}/priority`)
      .set('Authorization', `Bearer ${agentToken}`)
      .send({ priority: 'Critical' });

    assert.strictEqual(priorityRes.status, 200);

    const priorityNotif = await Notification.findOne({
      recipient: userId,
      type: 'TICKET_PRIORITY_CHANGED',
      ticket: testTicket._id,
    });

    assert.ok(priorityNotif, 'Creator should receive priority change notification');
    assert.ok(priorityNotif.message.includes('Critical'));
  });

  test('20. Comment addition automatically generates notification for ticket participants', async () => {
    // User comments on ticket -> agent should be notified
    const commentRes = await request(app)
      .post(`/api/tickets/${testTicket._id}/comments`)
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        message: 'Could you please provide an estimated time to fix this hardware issue?',
      });

    assert.strictEqual(commentRes.status, 201);

    const commentNotif = await Notification.findOne({
      recipient: agentId,
      type: 'TICKET_COMMENT',
      ticket: testTicket._id,
    });

    assert.ok(commentNotif, 'Agent should receive notification on user comment');
    assert.ok(commentNotif.message.includes('Could you please provide'));
  });
});
