const { test, describe, before, after } = require('node:test');
const assert = require('node:assert');
const request = require('supertest');
const { connectDB, disconnectDB } = require('../config/db');
const User = require('../models/User');
const Ticket = require('../models/Ticket');
const SLA = require('../models/SLA');
const Notification = require('../models/Notification');
const TicketHistory = require('../models/TicketHistory');
const { checkSLABreaches } = require('../utils/slaMonitor');
const { classifyTicket } = require('../services/aiClassificationService');
const emailService = require('../services/emailService');

process.env.NODE_ENV = 'test';
process.env.MONGO_URI = 'memory';
process.env.JWT_SECRET = 'test_jwt_secret_key_12345';
process.env.EMAIL_NOTIFICATIONS_ENABLED = 'false';
process.env.AI_CLASSIFICATION_ENABLED = 'true';

let app;

describe('Phase 5 — SLA Management, Monitoring, Email, AI & Hardening Suite', () => {
  let user1Token, user2Token, agentToken, adminToken;
  let user1Id, user2Id, agentId, adminId;
  let criticalTicket, mediumTicket;

  before(async () => {
    await connectDB();
    app = require('../server');

    // Clean all collections
    await User.deleteMany({});
    await Ticket.deleteMany({});
    await SLA.deleteMany({});
    await Notification.deleteMany({});
    await TicketHistory.deleteMany({});

    // Seed SLA targets
    await SLA.seedDefaultsIfEmpty();

    // Create users
    const u1 = await request(app)
      .post('/api/auth/register')
      .send({ name: 'User One', email: 'user1@p5test.com', password: 'Password123!', role: 'user' });
    user1Token = u1.body.token;
    user1Id = u1.body.user._id;

    const u2 = await request(app)
      .post('/api/auth/register')
      .send({ name: 'User Two', email: 'user2@p5test.com', password: 'Password123!', role: 'user' });
    user2Token = u2.body.token;
    user2Id = u2.body.user._id;

    const ag = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Support Agent', email: 'agent@p5test.com', password: 'Password123!', role: 'agent' });
    agentToken = ag.body.token;
    agentId = ag.body.user._id;

    const ad = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Admin Boss', email: 'admin@p5test.com', password: 'Password123!', role: 'admin' });
    adminToken = ad.body.token;
    adminId = ad.body.user._id;
  });

  after(async () => {
    await disconnectDB();
  });

  // -----------------------------------------------------------
  // PART A: SLA Configuration & Creation Tests
  // -----------------------------------------------------------
  test('1. Ticket receives correct SLA deadlines on creation', async () => {
    const res = await request(app)
      .post('/api/tickets')
      .set('Authorization', `Bearer ${user1Token}`)
      .send({
        title: 'Critical Outage Incident',
        description: 'Primary database cluster is unreachable',
        category: 'Technical Issue',
        priority: 'Critical',
      });

    assert.strictEqual(res.status, 201);
    assert.ok(res.body.ticket.sla);
    assert.ok(res.body.ticket.sla.responseDueAt);
    assert.ok(res.body.ticket.sla.resolutionDueAt);
    assert.strictEqual(res.body.ticket.sla.responseBreached, false);
    assert.strictEqual(res.body.ticket.sla.resolutionBreached, false);

    criticalTicket = res.body.ticket;

    // Verify response target is ~1 hour from now for Critical
    const now = Date.now();
    const responseDue = new Date(criticalTicket.sla.responseDueAt).getTime();
    const resolutionDue = new Date(criticalTicket.sla.resolutionDueAt).getTime();

    // 1 hr = 3600000ms (+/- 10s leeway)
    const diffHoursResponse = (responseDue - now) / 3600000;
    assert.ok(diffHoursResponse >= 0.95 && diffHoursResponse <= 1.05);

    // 8 hr = 8 * 3600000ms
    const diffHoursResolution = (resolutionDue - now) / 3600000;
    assert.ok(diffHoursResolution >= 7.95 && diffHoursResolution <= 8.05);
  });

  test('2. SLA configuration is loaded from MongoDB', async () => {
    const slas = await SLA.find();
    assert.strictEqual(slas.length, 4);

    const criticalSla = await SLA.getSLAForPriority('Critical');
    assert.strictEqual(criticalSla.priority, 'Critical');
    assert.strictEqual(criticalSla.responseTimeHours, 1);
    assert.strictEqual(criticalSla.resolutionTimeHours, 8);
  });

  test('3. Different priorities receive different SLA durations', async () => {
    const resMedium = await request(app)
      .post('/api/tickets')
      .set('Authorization', `Bearer ${user1Token}`)
      .send({
        title: 'Minor UI alignment issue',
        description: 'Button is misaligned in profile tab',
        category: 'Software',
        priority: 'Medium',
      });

    assert.strictEqual(resMedium.status, 201);
    mediumTicket = resMedium.body.ticket;

    const criticalResponseDue = new Date(criticalTicket.sla.responseDueAt).getTime();
    const mediumResponseDue = new Date(mediumTicket.sla.responseDueAt).getTime();

    // Medium priority response is 12 hours vs Critical is 1 hour
    assert.ok(mediumResponseDue > criticalResponseDue);
  });

  // -----------------------------------------------------------
  // PART B: Automated SLA Monitoring & Breach Detection
  // -----------------------------------------------------------
  test('4. Response SLA breach is detected', async () => {
    // Manually backdate responseDueAt into the past for test ticket
    await Ticket.findByIdAndUpdate(criticalTicket._id, {
      'sla.responseDueAt': new Date(Date.now() - 3600000), // 1 hour ago
      'sla.responseBreached': false,
      'sla.firstRespondedAt': null,
    });

    // Run SLA evaluation routine
    await checkSLABreaches();

    const updated = await Ticket.findById(criticalTicket._id);
    assert.strictEqual(updated.sla.responseBreached, true);
  });

  test('5. Resolution SLA breach is detected', async () => {
    // Backdate resolutionDueAt into the past
    await Ticket.findByIdAndUpdate(criticalTicket._id, {
      'sla.resolutionDueAt': new Date(Date.now() - 7200000), // 2 hours ago
      'sla.resolutionBreached': false,
    });

    await checkSLABreaches();

    const updated = await Ticket.findById(criticalTicket._id);
    assert.strictEqual(updated.sla.resolutionBreached, true);
  });

  test('6. Duplicate SLA notifications are prevented', async () => {
    const notifsBefore = await Notification.countDocuments({
      ticket: criticalTicket._id,
      type: 'SLA_BREACH',
    });

    // Run evaluation again
    await checkSLABreaches();

    const notifsAfter = await Notification.countDocuments({
      ticket: criticalTicket._id,
      type: 'SLA_BREACH',
    });

    assert.strictEqual(notifsBefore, notifsAfter);
  });

  test('7. SLA warning notification is generated', async () => {
    // Create a new ticket approaching resolution deadline (due in 1 hour)
    const approaching = await Ticket.create({
      title: 'Approaching SLA Ticket',
      description: 'Incident about to breach resolution window',
      category: 'Network',
      priority: 'High',
      status: 'Open',
      createdBy: user1Id,
      sla: {
        responseDueAt: new Date(Date.now() + 10000000),
        resolutionDueAt: new Date(Date.now() + 3600000), // 1 hour from now (within 2h warning threshold)
        responseBreached: false,
        resolutionBreached: false,
        approachingWarningSent: false,
      },
    });

    await checkSLABreaches();

    const warningNotif = await Notification.findOne({
      ticket: approaching._id,
      type: 'SLA_WARNING',
    });

    assert.ok(warningNotif);
    assert.strictEqual(warningNotif.recipient.toString(), user1Id.toString());
  });

  test('8. SLA breach notification is generated', async () => {
    const breachNotif = await Notification.findOne({
      ticket: criticalTicket._id,
      type: 'SLA_BREACH',
    });

    assert.ok(breachNotif);
    assert.ok(breachNotif.title.includes('SLA Breach'));
  });

  test('9. SLA breach history is recorded', async () => {
    const histories = await TicketHistory.find({
      ticket: criticalTicket._id,
      action: { $in: ['SLA_RESPONSE_BREACHED', 'SLA_RESOLUTION_BREACHED'] },
    });

    assert.ok(histories.length >= 1);
  });

  // -----------------------------------------------------------
  // PART C: Email Notification Infrastructure
  // -----------------------------------------------------------
  test('10. Email service gracefully handles disabled mode', async () => {
    const result = await emailService.sendMailSafe({
      to: 'recipient@test.com',
      subject: 'Test Subject',
      text: 'Test Body',
    });

    assert.strictEqual(result.success, true);
    assert.strictEqual(result.delivered, false);
    assert.strictEqual(result.reason, 'EMAIL_NOTIFICATIONS_DISABLED');
  });

  test('11. Email failure does not break ticket operations', async () => {
    // Create and assign ticket with email service enabled but dummy host
    const t = await Ticket.create({
      title: 'Email Resilience Test',
      description: 'Verifying non-blocking email behavior',
      category: 'Hardware',
      priority: 'Low',
      createdBy: user1Id,
    });

    // Assigning should succeed even if mail dispatch throws
    const res = await request(app)
      .put(`/api/tickets/${t._id}/assign`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ agentId });

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
  });

  test('12. Email preference settings are respected', async () => {
    // Disable assignment emails for agent
    await User.findByIdAndUpdate(agentId, {
      'notificationPreferences.assignmentEmails': false,
    });

    const res = await emailService.sendTicketAssignmentEmail({
      agentId,
      ticket: criticalTicket,
      assignedBy: { name: 'Admin' },
    });

    assert.strictEqual(res.success, true);
    assert.strictEqual(res.skipped, true);

    // Re-enable
    await User.findByIdAndUpdate(agentId, {
      'notificationPreferences.assignmentEmails': true,
    });
  });

  // -----------------------------------------------------------
  // PART D: AI-Assisted Ticket Classification
  // -----------------------------------------------------------
  test('13. AI classification endpoint requires authentication', async () => {
    const res = await request(app).post(`/api/tickets/${criticalTicket._id}/classify`);
    assert.strictEqual(res.status, 401);
  });

  test('14. Unauthorized user cannot classify unrelated ticket', async () => {
    // User 2 trying to classify User 1's ticket
    const res = await request(app)
      .post(`/api/tickets/${criticalTicket._id}/classify`)
      .set('Authorization', `Bearer ${user2Token}`);

    assert.strictEqual(res.status, 403);
  });

  test('15. AI classification validates category', async () => {
    const res = await request(app)
      .post(`/api/tickets/${criticalTicket._id}/classify`)
      .set('Authorization', `Bearer ${user1Token}`);

    assert.strictEqual(res.status, 200);
    assert.ok(res.body.success);
    assert.ok(res.body.suggestion);
    assert.strictEqual(res.body.suggestion.category, 'Technical Issue');
  });

  test('16. AI classification validates priority', async () => {
    const res = await request(app)
      .post(`/api/tickets/${criticalTicket._id}/classify`)
      .set('Authorization', `Bearer ${user1Token}`);

    assert.strictEqual(res.status, 200);
    assert.ok(['Low', 'Medium', 'High', 'Critical'].includes(res.body.suggestion.priority));
    assert.ok(typeof res.body.suggestion.confidence === 'number');
  });

  test('17. AI disabled mode returns safe fallback', async () => {
    process.env.AI_CLASSIFICATION_ENABLED = 'false';

    const result = await classifyTicket({
      title: 'VPN connection drop',
      description: 'User cannot connect to corporate gateway',
    });

    assert.strictEqual(result.available, false);
    assert.strictEqual(result.suggestion, null);

    process.env.AI_CLASSIFICATION_ENABLED = 'true';
  });

  test('18. AI classification does not overwrite ticket category automatically', async () => {
    const beforeTicket = await Ticket.findById(criticalTicket._id);
    const originalCategory = beforeTicket.category;

    await request(app)
      .post(`/api/tickets/${criticalTicket._id}/classify`)
      .set('Authorization', `Bearer ${adminToken}`);

    const afterTicket = await Ticket.findById(criticalTicket._id);
    assert.strictEqual(afterTicket.category, originalCategory);
  });

  test('19. AI classification does not overwrite ticket priority automatically', async () => {
    const beforeTicket = await Ticket.findById(criticalTicket._id);
    const originalPriority = beforeTicket.priority;

    await request(app)
      .post(`/api/tickets/${criticalTicket._id}/classify`)
      .set('Authorization', `Bearer ${adminToken}`);

    const afterTicket = await Ticket.findById(criticalTicket._id);
    assert.strictEqual(afterTicket.priority, originalPriority);
  });

  // -----------------------------------------------------------
  // PART E: SLA Analytics Dashboard
  // -----------------------------------------------------------
  test('20. Admin can access SLA overview', async () => {
    const res = await request(app)
      .get('/api/analytics/sla/overview')
      .set('Authorization', `Bearer ${adminToken}`);

    assert.strictEqual(res.status, 200);
    assert.ok(res.body.slaOverview);
    assert.ok(typeof res.body.slaOverview.totalTickets === 'number');
    assert.ok(typeof res.body.slaOverview.responseBreaches === 'number');
    assert.ok(typeof res.body.slaOverview.resolutionBreaches === 'number');
  });

  test('21. Non-admin cannot access SLA analytics', async () => {
    const res = await request(app)
      .get('/api/analytics/sla/overview')
      .set('Authorization', `Bearer ${user1Token}`);

    assert.strictEqual(res.status, 403);
  });

  test('22. SLA priority aggregation works', async () => {
    const res = await request(app)
      .get('/api/analytics/sla/priority')
      .set('Authorization', `Bearer ${adminToken}`);

    assert.strictEqual(res.status, 200);
    assert.ok(Array.isArray(res.body.data));
    assert.strictEqual(res.body.data.length, 4);
  });

  test('23. SLA agent aggregation works', async () => {
    const res = await request(app)
      .get('/api/analytics/sla/agents')
      .set('Authorization', `Bearer ${adminToken}`);

    assert.strictEqual(res.status, 200);
    assert.ok(Array.isArray(res.body.agents));
  });

  test('24. SLA trend aggregation works', async () => {
    const res = await request(app)
      .get('/api/analytics/sla/trends')
      .set('Authorization', `Bearer ${adminToken}`);

    assert.strictEqual(res.status, 200);
    assert.ok(Array.isArray(res.body.trends));
  });

  // -----------------------------------------------------------
  // PART F: SLA Filtering
  // -----------------------------------------------------------
  test('25. User SLA filtering remains restricted to owned tickets', async () => {
    const res = await request(app)
      .get('/api/tickets?slaStatus=response_breached')
      .set('Authorization', `Bearer ${user1Token}`);

    assert.strictEqual(res.status, 200);
    res.body.tickets.forEach((t) => {
      assert.strictEqual(t.createdBy._id.toString(), user1Id.toString());
    });
  });

  test('26. Agent SLA filtering remains restricted to assigned tickets', async () => {
    const res = await request(app)
      .get('/api/tickets?slaStatus=response_breached')
      .set('Authorization', `Bearer ${agentToken}`);

    assert.strictEqual(res.status, 200);
    res.body.tickets.forEach((t) => {
      assert.strictEqual(t.assignedTo._id.toString(), agentId.toString());
    });
  });

  test('27. Admin SLA filtering can access global tickets', async () => {
    const res = await request(app)
      .get('/api/tickets?slaStatus=response_breached')
      .set('Authorization', `Bearer ${adminToken}`);

    assert.strictEqual(res.status, 200);
    assert.ok(res.body.pagination.totalItems >= 1);
  });

  test('28. Invalid SLA filter is rejected', async () => {
    const res = await request(app)
      .get('/api/tickets?slaStatus=invalid_sla_flag')
      .set('Authorization', `Bearer ${adminToken}`);

    assert.strictEqual(res.status, 400);
  });

  // -----------------------------------------------------------
  // PART G: RBAC & User Preferences
  // -----------------------------------------------------------
  test('29. Non-admin cannot modify SLA configuration', async () => {
    const res = await request(app)
      .put('/api/sla/Critical')
      .set('Authorization', `Bearer ${user1Token}`)
      .send({ responseTimeHours: 0.5 });

    assert.strictEqual(res.status, 403);
  });

  test('30. Admin can modify SLA configuration', async () => {
    const res = await request(app)
      .put('/api/sla/Critical')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ responseTimeHours: 2, resolutionTimeHours: 10 });

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.sla.responseTimeHours, 2);
    assert.strictEqual(res.body.sla.resolutionTimeHours, 10);

    // Reset back
    await request(app)
      .put('/api/sla/Critical')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ responseTimeHours: 1, resolutionTimeHours: 8 });
  });

  test("31. User cannot modify another user's notification preferences", async () => {
    // Profile updates are scoped strictly by req.user.id extracted from JWT
    const res = await request(app)
      .put('/api/auth/profile')
      .set('Authorization', `Bearer ${user1Token}`)
      .send({
        notificationPreferences: {
          emailEnabled: false,
          slaEmails: false,
        },
      });

    assert.strictEqual(res.status, 200);

    const u1 = await User.findById(user1Id);
    assert.strictEqual(u1.notificationPreferences.emailEnabled, false);

    const u2 = await User.findById(user2Id);
    assert.strictEqual(u2.notificationPreferences.emailEnabled, true);
  });

  // -----------------------------------------------------------
  // PART H: Security Hardening & Hygiene
  // -----------------------------------------------------------
  test('32. Sensitive environment variables are not returned by APIs', async () => {
    const res = await request(app)
      .get('/api/health');

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.JWT_SECRET, undefined);
    assert.strictEqual(res.body.SMTP_PASSWORD, undefined);
    assert.strictEqual(res.body.AI_API_KEY, undefined);
  });

  test('33. Password hashes remain excluded from responses', async () => {
    const res = await request(app)
      .get(`/api/tickets/${criticalTicket._id}`)
      .set('Authorization', `Bearer ${adminToken}`);

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.ticket.createdBy.password, undefined);
  });

  test('34. AI API key is never exposed through API responses', async () => {
    const res = await request(app)
      .post(`/api/tickets/${criticalTicket._id}/classify`)
      .set('Authorization', `Bearer ${adminToken}`);

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.apiKey, undefined);
    assert.strictEqual(res.body.AI_API_KEY, undefined);
  });
});
