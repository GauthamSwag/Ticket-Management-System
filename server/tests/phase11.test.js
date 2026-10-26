const { test, describe, before, after } = require('node:test');
const assert = require('node:assert');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');
const { connectDB, disconnectDB } = require('../config/db');

process.env.NODE_ENV = 'test';
process.env.MONGO_URI = 'memory';
process.env.JWT_SECRET = 'phase11_production_grade_secret_key_security_audit';
process.env.CLIENT_URL = 'http://localhost:3000';
process.env.EMAIL_NOTIFICATIONS_ENABLED = 'false';

let app;
const User = require('../models/User');
const Ticket = require('../models/Ticket');
const Comment = require('../models/Comment');

describe('Phase 11 — Core Security, CORS, Authentication Hardening & DB Invariance Suite', () => {
  let adminUser, adminToken;
  let normalUser, userToken;
  let targetUser, targetToken;
  let agentUser, agentToken;
  let sampleTicket;

  before(async () => {
    await connectDB();
    app = require('../server');

    await User.deleteMany({});
    await Ticket.deleteMany({});
    await Comment.deleteMany({});

    // 1. Seed Admin User
    adminUser = await User.create({
      name: 'Security Admin',
      email: 'sec_admin@phase11.com',
      password: 'SecAdminPassword123!',
      role: 'admin',
      department: 'Infosec',
    });
    adminToken = jwt.sign({ id: adminUser._id }, process.env.JWT_SECRET, { expiresIn: '1h' });

    // 2. Seed Normal User (Attacker scenario)
    normalUser = await User.create({
      name: 'Unprivileged User',
      email: 'attacker_user@phase11.com',
      password: 'UserPassword123!',
      role: 'user',
      department: 'Marketing',
    });
    userToken = jwt.sign({ id: normalUser._id }, process.env.JWT_SECRET, { expiresIn: '1h' });

    // 3. Seed Target User (Victim account for privilege escalation tests)
    targetUser = await User.create({
      name: 'Target Victim User',
      email: 'target_victim@phase11.com',
      password: 'VictimPassword123!',
      role: 'user',
      department: 'Operations',
      isActive: true,
    });
    targetToken = jwt.sign({ id: targetUser._id }, process.env.JWT_SECRET, { expiresIn: '1h' });

    // 4. Seed Support Agent
    agentUser = await User.create({
      name: 'Security Agent',
      email: 'sec_agent@phase11.com',
      password: 'AgentPassword123!',
      role: 'agent',
      department: 'Technical Support',
    });
    agentToken = jwt.sign({ id: agentUser._id }, process.env.JWT_SECRET, { expiresIn: '1h' });

    // 5. Seed Ticket for data leakage checks
    sampleTicket = await Ticket.create({
      title: 'Security Audit Ticket Payload',
      description: 'Verifying that populated user sub-documents never leak password hashes.',
      category: 'Technical Issue',
      priority: 'High',
      status: 'Assigned',
      createdBy: normalUser._id,
      assignedTo: agentUser._id,
    });
  });

  after(async () => {
    await disconnectDB();
  });

  // ===========================================================================
  // 1. CORS CONFIGURATION & PREFLIGHT OPTIONS TESTS
  // ===========================================================================
  test('1. CORS: OPTIONS preflight to protected endpoint returns strict origin and credentials', async () => {
    const res = await request(app)
      .options('/api/auth/me')
      .set('Origin', 'http://localhost:3000')
      .set('Access-Control-Request-Method', 'GET');

    assert.strictEqual(res.status, 204);
    assert.strictEqual(res.headers['access-control-allow-origin'], 'http://localhost:3000');
    assert.notStrictEqual(res.headers['access-control-allow-origin'], '*');
    assert.strictEqual(res.headers['access-control-allow-credentials'], 'true');
    assert.ok(res.headers['access-control-allow-methods']);
    assert.ok(res.headers['access-control-allow-methods'].includes('GET'));
    assert.ok(res.headers['access-control-allow-methods'].includes('POST'));
    assert.ok(res.headers['access-control-allow-methods'].includes('PUT'));
    assert.ok(res.headers['access-control-allow-methods'].includes('DELETE'));
  });

  test('2. CORS: Preflight for tickets API verifies methods and headers boundary', async () => {
    const res = await request(app)
      .options('/api/tickets')
      .set('Origin', 'http://localhost:3000')
      .set('Access-Control-Request-Method', 'POST');

    assert.strictEqual(res.status, 204);
    assert.strictEqual(res.headers['access-control-allow-origin'], 'http://localhost:3000');
    assert.strictEqual(res.headers['access-control-allow-credentials'], 'true');
  });

  // ===========================================================================
  // 2. JWT TAMPERING, EXPIRATION & AUTHENTICATION HARDENING
  // ===========================================================================
  test('3. JWT: Tampered signature is cleanly caught as JsonWebTokenError (401)', async () => {
    // Generate token signed with rogue secret
    const rogueToken = jwt.sign({ id: normalUser._id }, 'wrong_untrusted_secret_key');

    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${rogueToken}`);

    assert.strictEqual(res.status, 401);
    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error, 'JsonWebTokenError');
    assert.strictEqual(res.body.message, 'Not authorized, invalid or tampered token');
  });

  test('4. JWT: Expired token is cleanly caught as TokenExpiredError (401)', async () => {
    // Generate token expired 30 seconds ago
    const expiredToken = jwt.sign(
      { id: normalUser._id },
      process.env.JWT_SECRET,
      { expiresIn: '-30s' }
    );

    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${expiredToken}`);

    assert.strictEqual(res.status, 401);
    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error, 'TokenExpiredError');
    assert.strictEqual(res.body.message, 'Not authorized, token has expired');
  });

  test('5. JWT: Malformed tokens and missing Bearer headers reject cleanly (401)', async () => {
    // Malformed string
    const resMalformed = await request(app)
      .get('/api/auth/me')
      .set('Authorization', 'Bearer not-a-valid-jwt-token-string');
    assert.strictEqual(resMalformed.status, 401);
    assert.strictEqual(resMalformed.body.success, false);

    // Missing header entirely
    const resMissing = await request(app).get('/api/auth/me');
    assert.strictEqual(resMissing.status, 401);
    assert.strictEqual(resMissing.body.success, false);

    // Empty Bearer token
    const resEmpty = await request(app)
      .get('/api/auth/me')
      .set('Authorization', 'Bearer ');
    assert.strictEqual(resEmpty.status, 401);
    assert.strictEqual(resEmpty.body.success, false);
  });

  // ===========================================================================
  // 3. DATABASE STATE INVARIANCE ON UNAUTHORIZED MUTATIONS
  // ===========================================================================
  test('6. DB Invariance: Unauthorized role elevation attempt leaves target DB role unchanged', async () => {
    // Verify pre-condition in DB
    const preDbUser = await User.findById(targetUser._id);
    assert.strictEqual(preDbUser.role, 'user');

    // Normal user attempts unauthorized privilege escalation on target user
    const attackRes = await request(app)
      .put(`/api/auth/users/${targetUser._id}/role`)
      .set('Authorization', `Bearer ${userToken}`)
      .send({ role: 'admin' });

    // Assert HTTP status is 403 Forbidden
    assert.strictEqual(attackRes.status, 403);
    assert.strictEqual(attackRes.body.success, false);

    // DEEP DATABASE ASSERTION: Query MongoDB directly to verify zero data mutation
    const postDbUser = await User.findById(targetUser._id);
    assert.strictEqual(postDbUser.role, 'user', 'Target user role in database must remain "user"');
    assert.notStrictEqual(postDbUser.role, 'admin', 'Target user role in database must NOT be escalated to "admin"');
  });

  test('7. DB Invariance: Unauthorized account deactivation leaves target DB isActive unchanged', async () => {
    // Normal user attempts unauthorized account deactivation
    const attackRes = await request(app)
      .put(`/api/auth/users/${targetUser._id}/status`)
      .set('Authorization', `Bearer ${userToken}`)
      .send({ isActive: false });

    assert.strictEqual(attackRes.status, 403);
    assert.strictEqual(attackRes.body.success, false);

    // DEEP DATABASE ASSERTION: Query MongoDB directly
    const postDbUser = await User.findById(targetUser._id);
    assert.strictEqual(postDbUser.isActive, true, 'Target user isActive in database must remain true');
  });

  test('8. DB Invariance: Admin self-demotion is rejected and DB record remains "admin"', async () => {
    const demoteRes = await request(app)
      .put(`/api/auth/users/${adminUser._id}/role`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ role: 'user' });

    assert.strictEqual(demoteRes.status, 400);
    assert.strictEqual(demoteRes.body.success, false);

    // DEEP DATABASE ASSERTION: Admin account in MongoDB must still be 'admin'
    const adminInDb = await User.findById(adminUser._id);
    assert.strictEqual(adminInDb.role, 'admin', 'Admin role in MongoDB must remain "admin"');
  });

  test('9. DB Invariance: Admin self-deactivation is rejected and DB record remains active', async () => {
    const deactivateRes = await request(app)
      .put(`/api/auth/users/${adminUser._id}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ isActive: false });

    assert.strictEqual(deactivateRes.status, 400);
    assert.strictEqual(deactivateRes.body.success, false);

    // DEEP DATABASE ASSERTION: Admin account in MongoDB must remain active
    const adminInDb = await User.findById(adminUser._id);
    assert.strictEqual(adminInDb.isActive, true, 'Admin isActive in MongoDB must remain true');
  });

  // ===========================================================================
  // 4. DATA LEAKAGE AUDIT & SCHEMA VERIFICATION TESTS
  // ===========================================================================
  test('10. Data Leakage: GET /api/auth/me returns user profile without password or hash', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${userToken}`);

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert.ok(res.body.user);

    // Ensure password property does not exist in response object
    assert.strictEqual(res.body.user.password, undefined);
    assert.strictEqual('password' in res.body.user, false);
    assert.strictEqual(res.body.user.passwordHash, undefined);

    // Ensure no raw or hashed passwords exist anywhere in JSON string
    const jsonStr = JSON.stringify(res.body);
    assert.strictEqual(jsonStr.includes('UserPassword123!'), false);
    assert.strictEqual(jsonStr.includes('$2a$'), false);
    assert.strictEqual(jsonStr.includes('$2b$'), false);
    assert.strictEqual(jsonStr.includes(process.env.JWT_SECRET), false);

    // DEEP DATABASE CONTRAST ASSERTION:
    // Assert that the database DOES hold the salted bcrypt hash, proving the controller sanitized it
    const userInDb = await User.findById(normalUser._id).select('+password');
    assert.ok(userInDb.password, 'Password must exist in MongoDB');
    assert.ok(userInDb.password.startsWith('$2'), 'MongoDB must hold a bcrypt salted hash string');
  });

  test('11. Data Leakage: GET /api/auth/users directory excludes passwords from all records', async () => {
    const res = await request(app)
      .get('/api/auth/users')
      .set('Authorization', `Bearer ${adminToken}`);

    assert.strictEqual(res.status, 200);
    assert.ok(Array.isArray(res.body.users));
    assert.ok(res.body.users.length >= 3);

    for (const u of res.body.users) {
      assert.strictEqual(u.password, undefined, `User ${u.email} must not have password exposed`);
      assert.strictEqual('password' in u, false);
    }

    const jsonStr = JSON.stringify(res.body);
    assert.strictEqual(jsonStr.includes('$2a$'), false);
    assert.strictEqual(jsonStr.includes('$2b$'), false);
    assert.strictEqual(jsonStr.includes(process.env.JWT_SECRET), false);
  });

  test('12. Data Leakage: Ticket query populated user sub-documents never expose passwords', async () => {
    const res = await request(app)
      .get(`/api/tickets/${sampleTicket._id}`)
      .set('Authorization', `Bearer ${adminToken}`);

    assert.strictEqual(res.status, 200);
    const ticket = res.body.ticket;
    assert.ok(ticket);
    assert.ok(ticket.createdBy);
    assert.ok(ticket.assignedTo);

    // Validate creator sub-doc
    assert.strictEqual(ticket.createdBy.password, undefined);
    assert.strictEqual('password' in ticket.createdBy, false);

    // Validate assigned agent sub-doc
    assert.strictEqual(ticket.assignedTo.password, undefined);
    assert.strictEqual('password' in ticket.assignedTo, false);
  });

  // ===========================================================================
  // 5. INJECTION RESILIENCE & RE-DOS DEFENSE
  // ===========================================================================
  test('13. Injection Defense: NoSQL injection in login payload is rejected safely', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({
        email: { $gt: '' },
        password: 'UserPassword123!',
      });

    // Mongoose casting / validation or controller must reject non-string email
    assert.ok(res.status === 400 || res.status === 401, 'NoSQL query injection must not authenticate');
    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.token, undefined);
  });

  test('14. Injection Defense: Regex special characters in search do not crash or hang API', async () => {
    // ReDoS pattern / special characters
    const complexRegexSearch = '.*+?^${}()|[[\\]\\\\';
    const res = await request(app)
      .get(`/api/auth/users?search=${encodeURIComponent(complexRegexSearch)}`)
      .set('Authorization', `Bearer ${adminToken}`);

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.count, 0, 'Escaped regex string should safely return 0 matches');
  });

  // ===========================================================================
  // 6. ENVIRONMENT & SECRETS AUDIT VERIFICATION
  // ===========================================================================
  test('15. Environment Security: .env is in .gitignore and .env.example contains safe placeholders', async () => {
    const gitignorePath = path.join(__dirname, '../../.gitignore');
    assert.ok(fs.existsSync(gitignorePath), '.gitignore must exist');
    const gitignoreContent = fs.readFileSync(gitignorePath, 'utf8');
    assert.ok(gitignoreContent.includes('.env'), '.gitignore must ignore .env files');

    const envExamplePath = path.join(__dirname, '../../.env.example');
    assert.ok(fs.existsSync(envExamplePath), '.env.example must exist');
    const envExampleContent = fs.readFileSync(envExamplePath, 'utf8');
    // Ensure safe placeholder patterns
    assert.ok(envExampleContent.includes('your_jwt_secret_key_here'));
    assert.strictEqual(envExampleContent.includes('SecAdminPassword123!'), false);
    assert.strictEqual(envExampleContent.includes('mongodb+srv://'), false);
  });
});
