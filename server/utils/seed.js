const mongoose = require('mongoose');
const dotenv = require('dotenv');
const User = require('../models/User');
const Ticket = require('../models/Ticket');
const Counter = require('../models/Counter');
const SLA = require('../models/SLA');
const Comment = require('../models/Comment');
const Notification = require('../models/Notification');
const TicketHistory = require('../models/TicketHistory');
const { connectDB } = require('../config/db');

dotenv.config();

// Default enterprise users
const seedUsers = [
  {
    name: 'System Administrator',
    email: 'admin@example.com',
    password: 'password123',
    role: 'admin',
    department: 'Executive Management',
    phone: '+1-555-0100',
  },
  {
    name: 'Sarah Support Agent',
    email: 'agent@example.com',
    password: 'password123',
    role: 'agent',
    department: 'Technical Support Tier-2',
    phone: '+1-555-0101',
  },
  {
    name: 'Alex Chen',
    email: 'alex.agent@example.com',
    password: 'password123',
    role: 'agent',
    department: 'Infrastructure & DevOps',
    phone: '+1-555-0103',
  },
  {
    name: 'John Doe',
    email: 'user@example.com',
    password: 'password123',
    role: 'user',
    department: 'Engineering & Marketing',
    phone: '+1-555-0102',
  },
  {
    name: 'David Miller',
    email: 'david@example.com',
    password: 'password123',
    role: 'user',
    department: 'Finance & Accounting',
    phone: '+1-555-0104',
  },
  {
    name: 'Emily Watson',
    email: 'emily@example.com',
    password: 'password123',
    role: 'user',
    department: 'Product Management',
    phone: '+1-555-0105',
  },
];

// SLA targets matching SLA model defaults
const SLA_TARGETS = {
  Critical: { responseHours: 1, resolutionHours: 8 },
  High: { responseHours: 4, resolutionHours: 24 },
  Medium: { responseHours: 12, resolutionHours: 48 },
  Low: { responseHours: 24, resolutionHours: 72 },
};

// 15 Curated Realistic Enterprise Support Tickets
const enterpriseTickets = [
  {
    title: 'Production Database Connection Pool Exhaustion on US-East-1',
    description:
      'High latency and query timeout alerts triggered by Datadog APM on core microservice cluster. PostgreSQL connection pool reaching 98% saturation during morning peak load. Investigating connection leaks in transaction worker threads and tuning idle connection cleanup timeouts.',
    category: 'Technical Issue',
    priority: 'Critical',
    status: 'In Progress',
    creatorEmail: 'user@example.com',
    assignedEmail: 'agent@example.com',
    ageHours: 2.5,
    comments: [
      {
        authorEmail: 'agent@example.com',
        message:
          'Identified 3 orphaned worker connections stuck in "idle in transaction" state. Applying connection pooling patch in staging now.',
        offsetMinutes: 90,
      },
      {
        authorEmail: 'user@example.com',
        message:
          'Thanks Sarah, query latency spiked again at 09:15 AM. Please prioritize the hotfix deployment to production.',
        offsetMinutes: 45,
      },
    ],
  },
  {
    title: 'Enterprise Annual Invoicing Batch Run Stripe Webhook Timeout',
    description:
      'Automated annual billing run for Tier-1 corporate contracts failed at step 4 of 6. Stripe invoice.payment_succeeded webhook payloads received 504 Gateway Timeout responses from our billing ingress proxy. Currently 42 customer invoices pending retry in SQS dead-letter queue.',
    category: 'Billing',
    priority: 'High',
    status: 'Assigned',
    creatorEmail: 'david@example.com',
    assignedEmail: 'agent@example.com',
    ageHours: 3.5,
    comments: [
      {
        authorEmail: 'agent@example.com',
        message:
          'Ticket assigned to billing operations. Escalated to payments team to increase ingress timeout threshold to 30 seconds.',
        offsetMinutes: 120,
      },
    ],
  },
  {
    title: 'Okta SAML 2.0 Single Sign-On Certificate Expiry Notice',
    description:
      'Automated certificate health check reported that the corporate Okta IdP x509 token signing certificate is scheduled to expire in 72 hours. Need automated SAML metadata refresh and rollover keys in Okta Admin Console to prevent SSO authentication lockout for 450+ employees.',
    category: 'Account Issue',
    priority: 'High',
    status: 'Open',
    creatorEmail: 'emily@example.com',
    assignedEmail: null,
    ageHours: 1.5,
    comments: [],
  },
  {
    title: 'Core BGP Route Flapping Causing Packet Loss on EU-Central Peering Gateway',
    description:
      'Upstream transit provider Telia reported intermittent BGP session flapping on Frankfurt interconnect exchange. Edge router traffic experienced 14% packet loss on outbound HTTPS connections. Switched primary transit to Level3 failover link and stabilized routing tables.',
    category: 'Network',
    priority: 'Critical',
    status: 'Resolved',
    creatorEmail: 'user@example.com',
    assignedEmail: 'alex.agent@example.com',
    ageHours: 18,
    comments: [
      {
        authorEmail: 'alex.agent@example.com',
        message:
          'BGP route flap damping enabled. Upstream link stabilized with 0% packet loss over 4-hour soak test. Resolving ticket.',
        offsetMinutes: 180,
      },
      {
        authorEmail: 'user@example.com',
        message: 'Confirmed stable peering from European branch offices. Great resolution speed!',
        offsetMinutes: 120,
      },
    ],
  },
  {
    title: 'Docker Microservice CrashLoopBackOff in Staging Kubernetes Cluster',
    description:
      'Continuous integration automated deployment for release candidate v2.4.1 failed in namespace qa-k8s. Notification-worker pods repeatedly exiting with OOMKilled exit code 137. Memory heap dump indicates memory leak in unclosed WebSocket connection buffers.',
    category: 'Software',
    priority: 'Medium',
    status: 'In Progress',
    creatorEmail: 'user@example.com',
    assignedEmail: 'agent@example.com',
    ageHours: 6,
    comments: [
      {
        authorEmail: 'agent@example.com',
        message:
          'Heap dump analyzed. Socket leak traced to heartbeat ping setInterval not clearing on client disconnect. Submitting PR #412.',
        offsetMinutes: 240,
      },
    ],
  },
  {
    title: 'Executive Floor Cisco Catalyst Switch Port Amber LED & VLAN Isolation',
    description:
      'Physical switch stack Cisco Catalyst 9300 in 4th floor MDF closet showing amber fault LED on Port 24. Conference room VoIP terminals and Zoom Rooms hardware consoles unable to obtain DHCP IP address on VLAN 40 (Voice).',
    category: 'Hardware',
    priority: 'Medium',
    status: 'Assigned',
    creatorEmail: 'david@example.com',
    assignedEmail: 'alex.agent@example.com',
    ageHours: 8,
    comments: [
      {
        authorEmail: 'alex.agent@example.com',
        message:
          'Dispatching on-site technician with replacement SFP transceiver module and patch cable test kit.',
        offsetMinutes: 300,
      },
    ],
  },
  {
    title: 'SOC2 Type II Audit Log Export & S3 Glacier Compliance Retention',
    description:
      'External compliance auditor Ernst & Young requested sanitized administrator access logs, RBAC role transition audit trails, and immutable S3 Glacier vault retention receipts for audit period Q1-Q3 2026. Cryptographically hashed archive bundle generated and uploaded to secure auditor SFTP.',
    category: 'Other',
    priority: 'Low',
    status: 'Closed',
    creatorEmail: 'user@example.com',
    assignedEmail: 'agent@example.com',
    ageHours: 48,
    comments: [
      {
        authorEmail: 'agent@example.com',
        message:
          'Audit evidence package generated with SHA-256 integrity checksums. Securely transferred to auditor portal.',
        offsetMinutes: 1800,
      },
      {
        authorEmail: 'user@example.com',
        message:
          'Auditors confirmed receipt and validated all hash signatures. Ticket can be closed.',
        offsetMinutes: 1440,
      },
    ],
  },
  {
    title: 'Customer Ingress TLS 1.0/1.1 Deprecation & Modern Cipher Suite Enforcement',
    description:
      'Qualys SSL Labs perimeter security scan flagged legacy TLS 1.0 and TLS 1.1 protocol support on public customer API gateway. Need to restrict ingress TLS policy to TLS 1.2 and TLS 1.3 only, enforcing ECDHE-RSA-AES256-GCM-SHA384 and modern forward secrecy ciphers.',
    category: 'Technical Issue',
    priority: 'Medium',
    status: 'Open',
    creatorEmail: 'emily@example.com',
    assignedEmail: null,
    ageHours: 4,
    comments: [],
  },
  {
    title: 'Salesforce CRM Bidirectional Custom Field Synchronization Discrepancy',
    description:
      'Enterprise sales pipeline conversion events are failing to sync custom deal attributes between Salesforce Enterprise API and PostgreSQL data warehouse. JSON parsing error thrown on null value in contract_renewal_quarter property.',
    category: 'Software',
    priority: 'High',
    status: 'In Progress',
    creatorEmail: 'david@example.com',
    assignedEmail: 'agent@example.com',
    ageHours: 5,
    comments: [
      {
        authorEmail: 'agent@example.com',
        message:
          'Updated ETL schema mapping to handle nullable string types and replayed missed events from offset 84920.',
        offsetMinutes: 180,
      },
    ],
  },
  {
    title: 'SAN Storage Array Volume 3 Predictive NVMe Drive Failure Warning',
    description:
      'Dell EMC PowerStore storage array telemetry signaled SMART predictive failure warning on NVMe SSD Slot 07. Automatic RAID-6 rebuild into global hot spare initiated without downtime. Replacement drive hot-swap completed and parity verification completed at 100%.',
    category: 'Hardware',
    priority: 'Critical',
    status: 'Resolved',
    creatorEmail: 'user@example.com',
    assignedEmail: 'alex.agent@example.com',
    ageHours: 26,
    comments: [
      {
        authorEmail: 'alex.agent@example.com',
        message:
          'RMA replacement drive received and installed in enclosure Slot 07. Array health status verified Optimal.',
        offsetMinutes: 1320,
      },
    ],
  },
  {
    title: 'Corporate WireGuard VPN Split-Tunneling Internal DNS Resolution Failure on macOS',
    description:
      'Remote engineers on macOS Sonoma report that internal hostnames (*.corp.internal, *.stage.aws) fail DNS lookup when connected to corporate WireGuard VPN tunnel. Public internet traffic routes fine, but macOS scutil resolver configuration drops search domain.',
    category: 'Network',
    priority: 'Medium',
    status: 'Open',
    creatorEmail: 'user@example.com',
    assignedEmail: null,
    ageHours: 5.5,
    comments: [],
  },
  {
    title: 'AWS EC2 Decommissioned Instance Reserved Capacity Overbilling Dispute',
    description:
      'Monthly AWS consolidated billing invoice #INV-90218 billed 3 unused r5b.2xlarge reserved instances that were formally decommissioned on August 15th. AWS enterprise support approved credit adjustment of $1,420.50 credited toward next billing statement.',
    category: 'Billing',
    priority: 'Low',
    status: 'Closed',
    creatorEmail: 'david@example.com',
    assignedEmail: 'agent@example.com',
    ageHours: 72,
    comments: [
      {
        authorEmail: 'agent@example.com',
        message:
          'AWS enterprise billing team processed credit adjustment memo #CM-9912. Credit is visible in AWS Billing Dashboard.',
        offsetMinutes: 2400,
      },
    ],
  },
  {
    title: 'FIDO2 YubiKey 5C NFC Hardware Token Resynchronization Required',
    description:
      'Hardware security key YubiKey 5C NFC experienced credential counter desync during firmware update, causing multi-factor authentication prompt rejections on GitHub Enterprise and AWS SSO. Re-enrolled security key credentials in centralized IDP.',
    category: 'Account Issue',
    priority: 'Low',
    status: 'Resolved',
    creatorEmail: 'emily@example.com',
    assignedEmail: 'agent@example.com',
    ageHours: 14,
    comments: [
      {
        authorEmail: 'agent@example.com',
        message:
          'WebAuthn credential reset and re-registered successfully. Verified login with user.',
        offsetMinutes: 540,
      },
    ],
  },
  {
    title: 'Automated Nightly Database Snapshot Checksum Verification Failure',
    description:
      'Automated backup audit daemon reported SHA-256 checksum mismatch for snapshot cluster-snap-2026-09-30-0200 in secondary disaster recovery region us-west-2. Manual snapshot integrity verification and recovery point test required before scheduled rotation.',
    category: 'Technical Issue',
    priority: 'High',
    status: 'Open',
    creatorEmail: 'user@example.com',
    assignedEmail: null,
    ageHours: 1.2,
    comments: [],
  },
  {
    title: 'Engineering Pod 4B Ergonomic Dual-Monitor Mount & Power Rail Relocation',
    description:
      'Workstation facilities setup request for incoming senior frontend engineer at Pod 4B. Installation of heavy-duty dual 32-inch monitor gas-spring arms, 100W USB-C dock, and under-desk cable management raceway.',
    category: 'Other',
    priority: 'Low',
    status: 'Open',
    creatorEmail: 'david@example.com',
    assignedEmail: null,
    ageHours: 3,
    comments: [],
  },
];

/**
 * Core seeding function
 * @param {boolean} clearExisting If true, drops and resets existing collections
 */
const seedCoreData = async (clearExisting = false) => {
  const now = Date.now();

  // 1. SLA Rules initialization
  await SLA.seedDefaultsIfEmpty();

  // 2. Handle Users
  let userMap = {};
  if (clearExisting) {
    console.log('[Seed] Clearing existing users, tickets, comments, and notifications...');
    await User.deleteMany();
    await Ticket.deleteMany();
    await Comment.deleteMany();
    await Notification.deleteMany();
    await TicketHistory.deleteMany();
    await Counter.findOneAndUpdate({ id: 'ticketId' }, { seq: 0 }, { upsert: true });

    for (const userData of seedUsers) {
      const created = await User.create(userData);
      userMap[created.email] = created;
      console.log(`[Seed] Created ${created.role.padEnd(6)}: ${created.email}`);
    }
  } else {
    // Populate userMap from DB or create missing default users
    for (const userData of seedUsers) {
      let existing = await User.findOne({ email: userData.email });
      if (!existing) {
        existing = await User.create(userData);
        console.log(`[Seed] Provisioned missing user: ${existing.email}`);
      }
      userMap[userData.email] = existing;
    }
  }

  // Ensure Counter exists and reset if clearExisting
  if (clearExisting) {
    await Counter.findOneAndUpdate({ id: 'ticketId' }, { seq: 0 }, { upsert: true });
  }

  // 3. Seed 15 Curated Realistic Tickets
  console.log('[Seed] Provisioning 15 realistic enterprise tickets...');
  const createdTickets = [];

  for (let i = 0; i < enterpriseTickets.length; i++) {
    const def = enterpriseTickets[i];
    const creator = userMap[def.creatorEmail] || userMap['user@example.com'];
    const assignee = def.assignedEmail ? userMap[def.assignedEmail] : null;

    const createdAt = new Date(now - def.ageHours * 3600000);
    const slaCfg = SLA_TARGETS[def.priority] || SLA_TARGETS.Medium;
    const responseDueAt = new Date(createdAt.getTime() + slaCfg.responseHours * 3600000);
    const resolutionDueAt = new Date(createdAt.getTime() + slaCfg.resolutionHours * 3600000);

    let firstRespondedAt = null;
    let resolvedAt = null;
    let closedAt = null;

    if (def.status === 'In Progress') {
      firstRespondedAt = new Date(createdAt.getTime() + slaCfg.responseHours * 0.4 * 3600000);
    } else if (def.status === 'Resolved') {
      firstRespondedAt = new Date(createdAt.getTime() + slaCfg.responseHours * 0.3 * 3600000);
      resolvedAt = new Date(createdAt.getTime() + slaCfg.resolutionHours * 0.6 * 3600000);
    } else if (def.status === 'Closed') {
      firstRespondedAt = new Date(createdAt.getTime() + slaCfg.responseHours * 0.3 * 3600000);
      resolvedAt = new Date(createdAt.getTime() + slaCfg.resolutionHours * 0.6 * 3600000);
      closedAt = new Date(resolvedAt.getTime() + 4 * 3600000);
    }

    const responseBreached = firstRespondedAt
      ? firstRespondedAt > responseDueAt
      : now > responseDueAt;
    const resolutionBreached = resolvedAt ? resolvedAt > resolutionDueAt : now > resolutionDueAt;

    // Create ticket via Mongoose model (triggers pre-validate to generate sequential TKT-000001 ... TKT-000015)
    const ticket = await Ticket.create({
      title: def.title,
      description: def.description,
      category: def.category,
      priority: def.priority,
      status: def.status,
      createdBy: creator._id,
      assignedTo: assignee ? assignee._id : null,
      resolvedAt,
      closedAt,
      sla: {
        responseDueAt,
        resolutionDueAt,
        responseBreached,
        resolutionBreached,
        firstRespondedAt,
        approachingWarningSent: false,
        responseBreachSent: responseBreached,
        resolutionBreachSent: resolutionBreached,
      },
      createdAt,
      updatedAt: resolvedAt || firstRespondedAt || createdAt,
    });

    createdTickets.push(ticket);
    console.log(
      `[Seed] [${ticket.ticketId}] (${ticket.priority.padEnd(8)}) ${ticket.status.padEnd(11)} - ${ticket.title.substring(0, 48)}...`
    );

    // Initial audit log
    await TicketHistory.create({
      ticket: ticket._id,
      performedBy: creator._id,
      action: 'TICKET_CREATED',
      description: `Ticket created by ${creator.name} with priority ${ticket.priority}`,
      newValue: { status: 'Open', priority: ticket.priority },
      createdAt,
    });

    // Lifecycle audit logs
    if (assignee) {
      const assignedTime = new Date(createdAt.getTime() + 15 * 60000);
      await TicketHistory.create({
        ticket: ticket._id,
        performedBy: userMap['admin@example.com']?._id || creator._id,
        action: 'TICKET_ASSIGNED',
        description: `Ticket assigned to ${assignee.name}`,
        oldValue: null,
        newValue: assignee._id,
        createdAt: assignedTime,
      });

      // Notification for assignee
      await Notification.create({
        recipient: assignee._id,
        type: 'TICKET_ASSIGNED',
        title: `Ticket Assigned: ${ticket.ticketId}`,
        message: `You have been assigned to ticket "${ticket.title}"`,
        ticket: ticket._id,
        isRead: def.status === 'Resolved' || def.status === 'Closed',
        createdAt: assignedTime,
      });
    }

    if (def.status === 'In Progress' || def.status === 'Resolved' || def.status === 'Closed') {
      const inProgressTime = new Date(createdAt.getTime() + 30 * 60000);
      await TicketHistory.create({
        ticket: ticket._id,
        performedBy: assignee ? assignee._id : creator._id,
        action: 'STATUS_CHANGED',
        description: 'Status changed from Assigned to In Progress',
        oldValue: 'Assigned',
        newValue: 'In Progress',
        createdAt: inProgressTime,
      });
    }

    if (resolvedAt) {
      await TicketHistory.create({
        ticket: ticket._id,
        performedBy: assignee ? assignee._id : creator._id,
        action: 'STATUS_CHANGED',
        description: 'Ticket marked as Resolved',
        oldValue: 'In Progress',
        newValue: 'Resolved',
        createdAt: resolvedAt,
      });

      await Notification.create({
        recipient: creator._id,
        type: 'TICKET_STATUS_CHANGED',
        title: `Ticket Resolved: ${ticket.ticketId}`,
        message: `Your ticket "${ticket.title}" has been resolved by ${assignee?.name || 'Support'}`,
        ticket: ticket._id,
        isRead: def.status === 'Closed',
        createdAt: resolvedAt,
      });
    }

    if (closedAt) {
      await TicketHistory.create({
        ticket: ticket._id,
        performedBy: creator._id,
        action: 'STATUS_CHANGED',
        description: 'Ticket closed after verification',
        oldValue: 'Resolved',
        newValue: 'Closed',
        createdAt: closedAt,
      });
    }

    // Seed realistic Comments
    if (def.comments && def.comments.length > 0) {
      for (const c of def.comments) {
        const commentAuthor = userMap[c.authorEmail] || creator;
        const commentTime = new Date(now - c.offsetMinutes * 60000);
        await Comment.create({
          ticket: ticket._id,
          user: commentAuthor._id,
          message: c.message,
          createdAt: commentTime,
        });

        await TicketHistory.create({
          ticket: ticket._id,
          performedBy: commentAuthor._id,
          action: 'COMMENT_ADDED',
          description: `${commentAuthor.name} added a comment`,
          createdAt: commentTime,
        });
      }
    }
  }

  // Seed rich enterprise notifications for admin
  const adminUser = userMap['admin@example.com'];
  if (adminUser) {
    await seedAdminNotifications(adminUser._id, createdTickets);
  }

  console.log(`[Seed] Successfully provisioned ${createdTickets.length} enterprise tickets.`);
};

/**
 * Seed realistic notifications for the administrator
 */
const seedAdminNotifications = async (adminId, tickets = []) => {
  const now = Date.now();
  const t1 = tickets[0] || null; // Production Database Issue (Critical)
  const t2 = tickets[1] || null; // Stripe Billing Timeout (High)
  const t3 = tickets[2] || null; // Okta SAML Expiry (High)
  const t4 = tickets[3] || null; // BGP Route Flapping (Critical/Resolved)
  const t7 = tickets[6] || null; // SOC2 Audit Log Export (Closed)

  const adminNotifications = [
    {
      recipient: adminId,
      type: 'SLA_BREACH',
      title: 'SLA Breach: Response Target Missed',
      message: `Critical ticket ${t1?.ticketId || 'TKT-000001'} ("${t1?.title || 'Production DB Issue'}") missed SLA response deadline.`,
      ticket: t1?._id || null,
      isRead: false,
      createdAt: new Date(now - 15 * 60000), // 15 mins ago
    },
    {
      recipient: adminId,
      type: 'SLA_WARNING',
      title: 'SLA Warning: Resolution Deadline Approaching',
      message: `High-priority ticket ${t2?.ticketId || 'TKT-000002'} is within 2 hours of its resolution deadline.`,
      ticket: t2?._id || null,
      isRead: false,
      createdAt: new Date(now - 45 * 60000), // 45 mins ago
    },
    {
      recipient: adminId,
      type: 'TICKET_CREATED',
      title: `Critical Incident Logged: ${t1?.ticketId || 'TKT-000001'}`,
      message: `John Doe created Critical ticket "${t1?.title || 'Production Database Connection Pool Exhaustion on US-East-1'}".`,
      ticket: t1?._id || null,
      isRead: false,
      createdAt: new Date(now - 2 * 3600000), // 2 hours ago
    },
    {
      recipient: adminId,
      type: 'TICKET_CREATED',
      title: `New High-Priority Ticket: ${t3?.ticketId || 'TKT-000003'}`,
      message: `Emily Watson submitted "${t3?.title || 'Okta SAML 2.0 Single Sign-On Certificate Expiry Notice'}" requiring administrative review.`,
      ticket: t3?._id || null,
      isRead: false,
      createdAt: new Date(now - 3 * 3600000), // 3 hours ago
    },
    {
      recipient: adminId,
      type: 'TICKET_COMMENT',
      title: `New Urgent Comment on ${t1?.ticketId || 'TKT-000001'}`,
      message: `Sarah Support Agent added a triage comment on "${t1?.title || 'Production DB Issue'}".`,
      ticket: t1?._id || null,
      isRead: false,
      createdAt: new Date(now - 90 * 60000), // 1.5 hours ago
    },
    {
      recipient: adminId,
      type: 'TICKET_ASSIGNED',
      title: `Ticket Assigned: ${t1?.ticketId || 'TKT-000001'}`,
      message: `Ticket "${t1?.title || 'Production Database Issue'}" was assigned to Sarah Support Agent.`,
      ticket: t1?._id || null,
      isRead: true,
      createdAt: new Date(now - 5 * 3600000), // 5 hours ago
    },
    {
      recipient: adminId,
      type: 'TICKET_PRIORITY_CHANGED',
      title: `Priority Escalated: ${t4?.ticketId || 'TKT-000004'}`,
      message: `Incident ${t4?.ticketId || 'TKT-000004'} priority was escalated to Critical by Sarah Support Agent.`,
      ticket: t4?._id || null,
      isRead: true,
      createdAt: new Date(now - 8 * 3600000), // 8 hours ago
    },
    {
      recipient: adminId,
      type: 'TICKET_STATUS_CHANGED',
      title: `Incident Resolved: ${t4?.ticketId || 'TKT-000004'}`,
      message: `Alex Chen marked "${t4?.title || 'Core BGP Route Flapping'}" as Resolved.`,
      ticket: t4?._id || null,
      isRead: true,
      createdAt: new Date(now - 12 * 3600000), // 12 hours ago
    },
    {
      recipient: adminId,
      type: 'TICKET_STATUS_CHANGED',
      title: `Compliance Incident Closed: ${t7?.ticketId || 'TKT-000007'}`,
      message: `Ticket ${t7?.ticketId || 'TKT-000007'} was verified and closed with SHA-256 integrity checksums.`,
      ticket: t7?._id || null,
      isRead: true,
      createdAt: new Date(now - 28 * 3600000), // 28 hours ago
    },
    {
      recipient: adminId,
      type: 'TICKET_CREATED',
      title: 'Enterprise Fleet Initialized',
      message: '15 enterprise support tickets are actively monitored across all queues.',
      ticket: null,
      isRead: true,
      createdAt: new Date(now - 36 * 3600000), // 36 hours ago
    },
  ];

  await Notification.insertMany(adminNotifications);
  console.log(`[Seed] Successfully provisioned ${adminNotifications.length} administrative notifications.`);
};

/**
 * CLI Entrypoint
 */
const seedData = async () => {
  try {
    await connectDB();
    await seedCoreData(true);
    console.log('[Seed] Seeding completed successfully!');
    if (require.main === module) {
      process.exit(0);
    }
  } catch (error) {
    console.error(`[Seed] Error seeding data: ${error.message}`);
    if (require.main === module) {
      process.exit(1);
    }
  }
};

/**
 * Server startup helper - automatically seeds if database is empty
 */
const seedDefaultsIfEmpty = async () => {
  try {
    const adminExists = await User.findOne({ email: 'admin@example.com' });
    const ticketCount = await Ticket.countDocuments();
    if (!adminExists || ticketCount === 0) {
      console.log('[Seed] Database empty or missing tickets. Auto-provisioning enterprise dataset...');
      await seedCoreData(false);
      console.log('[Seed] Auto-provisioning completed.');
    } else {
      // Ensure admin has realistic notifications even if database already had tickets
      const adminNotifCount = await Notification.countDocuments({ recipient: adminExists._id });
      if (adminNotifCount <= 1) {
        const existingTickets = await Ticket.find().sort({ createdAt: 1 }).limit(10);
        await seedAdminNotifications(adminExists._id, existingTickets);
      }
    }
  } catch (err) {
    console.error('[Seed] Error in seedDefaultsIfEmpty:', err.message);
  }
};

if (require.main === module) {
  seedData();
}

module.exports = { seedData, seedDefaultsIfEmpty, seedAdminNotifications };
