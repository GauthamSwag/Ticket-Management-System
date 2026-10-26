const { test, describe, before, after } = require('node:test');
const assert = require('node:assert');
const request = require('supertest');
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const { connectDB, disconnectDB } = require('../config/db');
const User = require('../models/User');
const Ticket = require('../models/Ticket');
const Comment = require('../models/Comment');
const Attachment = require('../models/Attachment');
const TicketHistory = require('../models/TicketHistory');
const Counter = require('../models/Counter');

process.env.NODE_ENV = 'test';
process.env.MONGO_URI = 'memory';
process.env.JWT_SECRET = 'test_jwt_secret_key_12345';

let app;

describe('Phase 3 — Comments, File Attachments & Audit History Test Suite', () => {
  let user1Token, user1Id;
  let user2Token, user2Id;
  let agent1Token, agent1Id;
  let agent2Token, agent2Id;
  let adminToken, adminId;
  let ticket1Id;
  let ticket2Id;
  let userCommentId;
  let adminCommentId;
  let attachmentId;
  let uploadedFilePathOnDisk;

  // Create dummy test files
  const testFilesDir = path.join(__dirname, 'test_files');
  const validTextFile = path.join(testFilesDir, 'sample.txt');
  const validPngFile = path.join(testFilesDir, 'test-image.png');
  const invalidExeFile = path.join(testFilesDir, 'malicious.exe');

  before(async () => {
    await connectDB();
    app = require('../server');

    await User.deleteMany({});
    await Ticket.deleteMany({});
    await Comment.deleteMany({});
    await Attachment.deleteMany({});
    await TicketHistory.deleteMany({});
    await Counter.deleteMany({});

    // Setup local test files directory
    if (!fs.existsSync(testFilesDir)) {
      fs.mkdirSync(testFilesDir, { recursive: true });
    }
    fs.writeFileSync(validTextFile, 'This is a sample text document for testing ticket attachments.');
    // 1x1 dummy PNG file
    const pngBuffer = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
      'base64'
    );
    fs.writeFileSync(validPngFile, pngBuffer);
    fs.writeFileSync(invalidExeFile, 'MZ executable dummy');

    // 1. Register User 1 (Alice)
    const u1Res = await request(app).post('/api/auth/register').send({
      name: 'Alice User',
      email: 'alice.p3@example.com',
      password: 'password123',
      role: 'user',
      department: 'Marketing',
    });
    user1Token = u1Res.body.token;
    user1Id = u1Res.body.user._id;

    // 2. Register User 2 (Bob)
    const u2Res = await request(app).post('/api/auth/register').send({
      name: 'Bob User',
      email: 'bob.p3@example.com',
      password: 'password123',
      role: 'user',
      department: 'Sales',
    });
    user2Token = u2Res.body.token;
    user2Id = u2Res.body.user._id;

    // 3. Register Assigned Agent (Charlie)
    const ag1Res = await request(app).post('/api/auth/register').send({
      name: 'Charlie Agent',
      email: 'charlie.p3@example.com',
      password: 'password123',
      role: 'agent',
      department: 'Technical Support',
    });
    agent1Token = ag1Res.body.token;
    agent1Id = ag1Res.body.user._id;

    // 4. Register Unassigned Agent (Dave)
    const ag2Res = await request(app).post('/api/auth/register').send({
      name: 'Dave Agent',
      email: 'dave.p3@example.com',
      password: 'password123',
      role: 'agent',
      department: 'Billing Support',
    });
    agent2Token = ag2Res.body.token;
    agent2Id = ag2Res.body.user._id;

    // 5. Register Admin (Diana)
    const adRes = await request(app).post('/api/auth/register').send({
      name: 'Diana Admin',
      email: 'diana.p3@example.com',
      password: 'password123',
      role: 'admin',
      department: 'Operations',
    });
    adminToken = adRes.body.token;
    adminId = adRes.body.user._id;

    // 6. User 1 creates Ticket 1
    const t1Res = await request(app)
      .post('/api/tickets')
      .set('Authorization', `Bearer ${user1Token}`)
      .send({
        title: 'Authentication failing on staging portal',
        description: 'Receiving 401 on login callback intermittently.',
        category: 'Technical Issue',
        priority: 'High',
      });
    ticket1Id = t1Res.body.ticket._id;

    // 7. User 2 creates Ticket 2
    const t2Res = await request(app)
      .post('/api/tickets')
      .set('Authorization', `Bearer ${user2Token}`)
      .send({
        title: 'Billing statement mismatch for September invoice',
        description: 'Line item total does not reflect promotional credit.',
        category: 'Billing',
        priority: 'Medium',
      });
    ticket2Id = t2Res.body.ticket._id;

    // 8. Admin assigns Ticket 1 to Agent 1 (Charlie)
    await request(app)
      .put(`/api/tickets/${ticket1Id}/assign`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ agentId: agent1Id });
  });

  after(async () => {
    // Clean up dummy test files
    try {
      if (fs.existsSync(testFilesDir)) {
        fs.rmSync(testFilesDir, { recursive: true, force: true });
      }
    } catch (e) {}

    await disconnectDB();
  });

  // =========================================================================
  // SECTION A: COMMENTS
  // =========================================================================

  test('1. Authorized user can comment on their own ticket', async () => {
    const res = await request(app)
      .post(`/api/tickets/${ticket1Id}/comments`)
      .set('Authorization', `Bearer ${user1Token}`)
      .send({ message: 'I tried clearing browser cache but the error persists.' });

    assert.strictEqual(res.status, 201);
    assert.strictEqual(res.body.success, true);
    assert.ok(res.body.comment._id);
    assert.strictEqual(res.body.comment.message, 'I tried clearing browser cache but the error persists.');
    assert.strictEqual(res.body.comment.user._id.toString(), user1Id.toString());
    userCommentId = res.body.comment._id;
  });

  test('2. User cannot comment on another user’s ticket (returns 403 Forbidden)', async () => {
    const res = await request(app)
      .post(`/api/tickets/${ticket1Id}/comments`)
      .set('Authorization', `Bearer ${user2Token}`)
      .send({ message: 'Unauthorized comment attempt from User 2.' });

    assert.strictEqual(res.status, 403);
    assert.strictEqual(res.body.success, false);
    assert.match(res.body.message, /not authorized to comment/i);
  });

  test('3. Assigned agent can comment on assigned ticket', async () => {
    const res = await request(app)
      .post(`/api/tickets/${ticket1Id}/comments`)
      .set('Authorization', `Bearer ${agent1Token}`)
      .send({ message: 'Investigating the OAuth2 token exchange logs on server.' });

    assert.strictEqual(res.status, 201);
    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.comment.user.role, 'agent');
  });

  test('4. Unassigned agent cannot comment on ticket (returns 403 Forbidden)', async () => {
    const res = await request(app)
      .post(`/api/tickets/${ticket1Id}/comments`)
      .set('Authorization', `Bearer ${agent2Token}`)
      .send({ message: 'Attempt by unassigned agent.' });

    assert.strictEqual(res.status, 403);
    assert.strictEqual(res.body.success, false);
  });

  test('5. Admin can comment on any ticket', async () => {
    const res = await request(app)
      .post(`/api/tickets/${ticket1Id}/comments`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ message: 'Escalated to engineering lead for priority triage.' });

    assert.strictEqual(res.status, 201);
    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.comment.user.role, 'admin');
    adminCommentId = res.body.comment._id;
  });

  test('6. Empty comment is rejected with 400 Bad Request', async () => {
    const res = await request(app)
      .post(`/api/tickets/${ticket1Id}/comments`)
      .set('Authorization', `Bearer ${user1Token}`)
      .send({ message: '   ' });

    assert.strictEqual(res.status, 400);
    assert.strictEqual(res.body.success, false);
    assert.match(res.body.message, /cannot be empty/i);
  });

  test('7. Comments are stored and retrieved in chronological order', async () => {
    const res = await request(app)
      .get(`/api/tickets/${ticket1Id}/comments`)
      .set('Authorization', `Bearer ${user1Token}`);

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert.ok(res.body.count >= 3);
    assert.strictEqual(res.body.comments[0]._id.toString(), userCommentId.toString());
  });

  test('8. Comment response does not expose user password hash', async () => {
    const res = await request(app)
      .get(`/api/tickets/${ticket1Id}/comments`)
      .set('Authorization', `Bearer ${user1Token}`);

    assert.strictEqual(res.status, 200);
    for (const c of res.body.comments) {
      assert.strictEqual(c.user.password, undefined);
    }
  });

  test('9. User can delete their own comment', async () => {
    // User creates a comment to delete
    const postRes = await request(app)
      .post(`/api/tickets/${ticket1Id}/comments`)
      .set('Authorization', `Bearer ${user1Token}`)
      .send({ message: 'Comment to be deleted by creator.' });

    const delId = postRes.body.comment._id;

    const delRes = await request(app)
      .delete(`/api/tickets/${ticket1Id}/comments/${delId}`)
      .set('Authorization', `Bearer ${user1Token}`);

    assert.strictEqual(delRes.status, 200);
    assert.strictEqual(delRes.body.success, true);
  });

  test('10. User cannot delete another user’s comment (returns 403 Forbidden)', async () => {
    const res = await request(app)
      .delete(`/api/tickets/${ticket1Id}/comments/${adminCommentId}`)
      .set('Authorization', `Bearer ${user1Token}`);

    assert.strictEqual(res.status, 403);
    assert.strictEqual(res.body.success, false);
    assert.match(res.body.message, /not authorized to delete/i);
  });

  test('11. Admin can delete any comment', async () => {
    const res = await request(app)
      .delete(`/api/tickets/${ticket1Id}/comments/${adminCommentId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
  });

  // =========================================================================
  // SECTION B: AUDIT HISTORY
  // =========================================================================

  test('12. Ticket creation generates TICKET_CREATED history record', async () => {
    const res = await request(app)
      .get(`/api/tickets/${ticket1Id}/history`)
      .set('Authorization', `Bearer ${user1Token}`);

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    const createdEvent = res.body.history.find((h) => h.action === 'TICKET_CREATED');
    assert.ok(createdEvent, 'TICKET_CREATED event should be logged');
    assert.strictEqual(createdEvent.performedBy._id.toString(), user1Id.toString());
  });

  test('13. Ticket update generates TICKET_UPDATED history record', async () => {
    await request(app)
      .put(`/api/tickets/${ticket1Id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ title: 'Authentication failing on staging portal (Updated)' });

    const res = await request(app)
      .get(`/api/tickets/${ticket1Id}/history`)
      .set('Authorization', `Bearer ${user1Token}`);

    assert.strictEqual(res.status, 200);
    const updateEvent = res.body.history.find((h) => h.action === 'TICKET_UPDATED');
    assert.ok(updateEvent, 'TICKET_UPDATED event should be logged');
  });

  test('14. Assignment generates TICKET_ASSIGNED history record', async () => {
    const res = await request(app)
      .get(`/api/tickets/${ticket1Id}/history`)
      .set('Authorization', `Bearer ${user1Token}`);

    assert.strictEqual(res.status, 200);
    const assignEvent = res.body.history.find((h) => h.action === 'TICKET_ASSIGNED');
    assert.ok(assignEvent, 'TICKET_ASSIGNED event should be logged');
  });

  test('15. Reassignment generates TICKET_REASSIGNED history record', async () => {
    // Reassign to Agent 2
    await request(app)
      .put(`/api/tickets/${ticket1Id}/assign`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ agentId: agent2Id });

    const res = await request(app)
      .get(`/api/tickets/${ticket1Id}/history`)
      .set('Authorization', `Bearer ${user1Token}`);

    assert.strictEqual(res.status, 200);
    const reassignEvent = res.body.history.find((h) => h.action === 'TICKET_REASSIGNED');
    assert.ok(reassignEvent, 'TICKET_REASSIGNED event should be logged');

    // Switch back to Agent 1 for remaining tests
    await request(app)
      .put(`/api/tickets/${ticket1Id}/assign`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ agentId: agent1Id });
  });

  test('16. Status change generates STATUS_CHANGED history record with old and new values', async () => {
    await request(app)
      .put(`/api/tickets/${ticket1Id}/status`)
      .set('Authorization', `Bearer ${agent1Token}`)
      .send({ status: 'In Progress' });

    const res = await request(app)
      .get(`/api/tickets/${ticket1Id}/history`)
      .set('Authorization', `Bearer ${user1Token}`);

    assert.strictEqual(res.status, 200);
    const statusEvent = res.body.history.find(
      (h) => h.action === 'STATUS_CHANGED' && h.newValue === 'In Progress'
    );
    assert.ok(statusEvent, 'STATUS_CHANGED event should be logged');
    assert.strictEqual(statusEvent.oldValue, 'Assigned');
    assert.strictEqual(statusEvent.newValue, 'In Progress');
  });

  test('17. Priority change generates PRIORITY_CHANGED history record', async () => {
    await request(app)
      .put(`/api/tickets/${ticket1Id}/priority`)
      .set('Authorization', `Bearer ${agent1Token}`)
      .send({ priority: 'Critical' });

    const res = await request(app)
      .get(`/api/tickets/${ticket1Id}/history`)
      .set('Authorization', `Bearer ${user1Token}`);

    assert.strictEqual(res.status, 200);
    const priorityEvent = res.body.history.find((h) => h.action === 'PRIORITY_CHANGED');
    assert.ok(priorityEvent, 'PRIORITY_CHANGED event should be logged');
    assert.strictEqual(priorityEvent.newValue, 'Critical');
  });

  test('18. Comment creation and deletion generate COMMENT_ADDED and COMMENT_DELETED history', async () => {
    const res = await request(app)
      .get(`/api/tickets/${ticket1Id}/history`)
      .set('Authorization', `Bearer ${user1Token}`);

    assert.strictEqual(res.status, 200);
    const commentAddEvent = res.body.history.find((h) => h.action === 'COMMENT_ADDED');
    const commentDelEvent = res.body.history.find((h) => h.action === 'COMMENT_DELETED');

    assert.ok(commentAddEvent, 'COMMENT_ADDED event should exist');
    assert.ok(commentDelEvent, 'COMMENT_DELETED event should exist');
  });

  test('19. Unauthorized users cannot access ticket history (returns 403 Forbidden)', async () => {
    const res = await request(app)
      .get(`/api/tickets/${ticket1Id}/history`)
      .set('Authorization', `Bearer ${user2Token}`);

    assert.strictEqual(res.status, 403);
    assert.strictEqual(res.body.success, false);
  });

  test('20. Authorized users can retrieve history without exposing passwords', async () => {
    const res = await request(app)
      .get(`/api/tickets/${ticket1Id}/history`)
      .set('Authorization', `Bearer ${agent1Token}`);

    assert.strictEqual(res.status, 200);
    assert.ok(Array.isArray(res.body.history));
    for (const h of res.body.history) {
      if (h.performedBy) {
        assert.strictEqual(h.performedBy.password, undefined);
      }
    }
  });

  // =========================================================================
  // SECTION C: ATTACHMENTS
  // =========================================================================

  test('21. Authorized user can upload allowed file (text/plain)', async () => {
    const res = await request(app)
      .post(`/api/tickets/${ticket1Id}/attachments`)
      .set('Authorization', `Bearer ${user1Token}`)
      .attach('file', validTextFile);

    assert.strictEqual(res.status, 201);
    assert.strictEqual(res.body.success, true);
    assert.ok(res.body.attachment._id);
    assert.strictEqual(res.body.attachment.originalName, 'sample.txt');
    assert.strictEqual(res.body.attachment.mimeType, 'text/plain');

    attachmentId = res.body.attachment._id;
    uploadedFilePathOnDisk = res.body.attachment.filePath;
    assert.ok(fs.existsSync(uploadedFilePathOnDisk), 'Physical file must exist on disk');
  });

  test('22. Unauthorized user cannot upload to another user’s ticket (returns 403 Forbidden)', async () => {
    const res = await request(app)
      .post(`/api/tickets/${ticket1Id}/attachments`)
      .set('Authorization', `Bearer ${user2Token}`)
      .attach('file', validTextFile);

    assert.strictEqual(res.status, 403);
    assert.strictEqual(res.body.success, false);
  });

  test('23. Assigned agent can upload attachment to assigned ticket', async () => {
    const res = await request(app)
      .post(`/api/tickets/${ticket1Id}/attachments`)
      .set('Authorization', `Bearer ${agent1Token}`)
      .attach('file', validPngFile);

    assert.strictEqual(res.status, 201);
    assert.strictEqual(res.body.attachment.originalName, 'test-image.png');
    assert.strictEqual(res.body.attachment.mimeType, 'image/png');
  });

  test('24. Admin can upload attachment to any ticket', async () => {
    const res = await request(app)
      .post(`/api/tickets/${ticket1Id}/attachments`)
      .set('Authorization', `Bearer ${adminToken}`)
      .attach('file', validTextFile);

    assert.strictEqual(res.status, 201);
    assert.strictEqual(res.body.success, true);
  });

  test('25. Unsupported file type (.exe) is rejected with 400 Bad Request', async () => {
    const res = await request(app)
      .post(`/api/tickets/${ticket1Id}/attachments`)
      .set('Authorization', `Bearer ${user1Token}`)
      .attach('file', invalidExeFile);

    assert.strictEqual(res.status, 400);
    assert.strictEqual(res.body.success, false);
    assert.match(res.body.message, /not permitted/i);
  });

  test('26. Attachment metadata is stored and can be listed', async () => {
    const res = await request(app)
      .get(`/api/tickets/${ticket1Id}/attachments`)
      .set('Authorization', `Bearer ${user1Token}`);

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert.ok(res.body.count >= 2);
    const sample = res.body.attachments.find((a) => a._id.toString() === attachmentId.toString());
    assert.ok(sample);
    assert.strictEqual(sample.originalName, 'sample.txt');
    assert.ok(sample.size > 0);
    assert.strictEqual(sample.uploadedBy.password, undefined);
  });

  test('27. Authorized user can safely download attachment', async () => {
    const res = await request(app)
      .get(`/api/tickets/${ticket1Id}/attachments/${attachmentId}`)
      .set('Authorization', `Bearer ${user1Token}`);

    assert.strictEqual(res.status, 200);
    assert.match(res.headers['content-disposition'], /attachment; filename="sample.txt"/);
  });

  test('28. Unauthorized user cannot download another ticket’s attachment (returns 403 Forbidden)', async () => {
    const res = await request(app)
      .get(`/api/tickets/${ticket1Id}/attachments/${attachmentId}`)
      .set('Authorization', `Bearer ${user2Token}`);

    assert.strictEqual(res.status, 403);
    assert.strictEqual(res.body.success, false);
  });

  test('29. User cannot delete another user’s attachment (returns 403 Forbidden)', async () => {
    // Admin uploads an attachment
    const adminUpload = await request(app)
      .post(`/api/tickets/${ticket1Id}/attachments`)
      .set('Authorization', `Bearer ${adminToken}`)
      .attach('file', validTextFile);

    const adminAttId = adminUpload.body.attachment._id;

    // User 1 tries to delete Admin's attachment
    const res = await request(app)
      .delete(`/api/tickets/${ticket1Id}/attachments/${adminAttId}`)
      .set('Authorization', `Bearer ${user1Token}`);

    assert.strictEqual(res.status, 403);
    assert.strictEqual(res.body.success, false);
    assert.match(res.body.message, /not authorized to delete/i);
  });

  test('30. Authorized user can delete their own attachment and physical file is removed from disk', async () => {
    assert.ok(fs.existsSync(uploadedFilePathOnDisk), 'File must exist before deletion');

    const res = await request(app)
      .delete(`/api/tickets/${ticket1Id}/attachments/${attachmentId}`)
      .set('Authorization', `Bearer ${user1Token}`);

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert.strictEqual(fs.existsSync(uploadedFilePathOnDisk), false, 'Physical file must be deleted from disk');
  });

  test('31. Attachment upload and deletion create ATTACHMENT_ADDED and ATTACHMENT_DELETED history records', async () => {
    const res = await request(app)
      .get(`/api/tickets/${ticket1Id}/history`)
      .set('Authorization', `Bearer ${user1Token}`);

    assert.strictEqual(res.status, 200);
    const addEvent = res.body.history.find((h) => h.action === 'ATTACHMENT_ADDED');
    const delEvent = res.body.history.find((h) => h.action === 'ATTACHMENT_DELETED');

    assert.ok(addEvent, 'ATTACHMENT_ADDED must be logged');
    assert.ok(delEvent, 'ATTACHMENT_DELETED must be logged');
  });
});
