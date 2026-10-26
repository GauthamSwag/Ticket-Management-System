const cron = require('node-cron');
const Ticket = require('../models/Ticket');
const TicketHistory = require('../models/TicketHistory');
const { sendNotification } = require('./notificationService');
const { sendSLAWarningEmail, sendSLABreachEmail } = require('../services/emailService');
const { emitToTicket, emitToAdmins, emitToUser } = require('../socket');

let cronTask = null;

/**
 * Core SLA evaluation routine
 * Inspects all active (unresolved, unclosed) tickets
 */
const checkSLABreaches = async () => {
  try {
    const now = new Date();

    // Find active tickets that have SLA configurations
    const activeTickets = await Ticket.find({
      status: { $nin: ['Resolved', 'Closed'] },
      $or: [
        { 'sla.responseDueAt': { $ne: null } },
        { 'sla.resolutionDueAt': { $ne: null } },
      ],
    }).populate('createdBy', 'name email notificationPreferences').populate('assignedTo', 'name email notificationPreferences');

    for (const ticket of activeTickets) {
      if (!ticket.sla) continue;

      let ticketModified = false;

      // 1. Check Response SLA Breach
      // Breached if no first response has occurred yet, and current time > responseDueAt
      if (
        !ticket.sla.firstRespondedAt &&
        ticket.sla.responseDueAt &&
        now > ticket.sla.responseDueAt &&
        !ticket.sla.responseBreached
      ) {
        ticket.sla.responseBreached = true;
        ticketModified = true;

        if (!ticket.sla.responseBreachSent) {
          ticket.sla.responseBreachSent = true;

          // Record in Audit History
          await TicketHistory.create({
            ticket: ticket._id,
            performedBy: ticket.assignedTo?._id || ticket.createdBy?._id || null,
            action: 'SLA_RESPONSE_BREACHED',
            description: `Response SLA target breached. Target was ${new Date(ticket.sla.responseDueAt).toLocaleString()}`,
            oldValue: false,
            newValue: true,
          });

          // In-app Notification to assigned agent or creator
          const recipients = [];
          if (ticket.assignedTo) recipients.push(ticket.assignedTo._id);
          else if (ticket.createdBy) recipients.push(ticket.createdBy._id);

          for (const recipientId of recipients) {
            await sendNotification({
              recipient: recipientId,
              type: 'SLA_BREACH',
              title: 'SLA Breach: Response Target Missed',
              message: `Ticket ${ticket.ticketId} has exceeded its response SLA target.`,
              ticket,
            });

            // Email alert
            sendSLABreachEmail({
              userId: recipientId,
              ticket,
              breachType: 'First Response',
            }).catch(() => {});
          }

          // Real-time WebSocket emission
          emitToTicket(ticket.ticketId, 'sla:breached', {
            ticketId: ticket.ticketId,
            breachType: 'response',
            dueAt: ticket.sla.responseDueAt,
            timestamp: new Date(),
          });
          emitToAdmins('sla:breached', {
            ticketId: ticket.ticketId,
            breachType: 'response',
            dueAt: ticket.sla.responseDueAt,
            timestamp: new Date(),
          });
        }
      }

      // 2. Check Resolution SLA Breach
      // Breached if current time > resolutionDueAt
      if (
        ticket.sla.resolutionDueAt &&
        now > ticket.sla.resolutionDueAt &&
        !ticket.sla.resolutionBreached
      ) {
        ticket.sla.resolutionBreached = true;
        ticketModified = true;

        if (!ticket.sla.resolutionBreachSent) {
          ticket.sla.resolutionBreachSent = true;

          // Record in Audit History
          await TicketHistory.create({
            ticket: ticket._id,
            performedBy: ticket.assignedTo?._id || ticket.createdBy?._id || null,
            action: 'SLA_RESOLUTION_BREACHED',
            description: `Resolution SLA target breached. Target was ${new Date(ticket.sla.resolutionDueAt).toLocaleString()}`,
            oldValue: false,
            newValue: true,
          });

          // In-app Notifications
          const breachRecipients = [];
          if (ticket.assignedTo) breachRecipients.push(ticket.assignedTo._id);
          if (ticket.createdBy && (!ticket.assignedTo || ticket.createdBy._id.toString() !== ticket.assignedTo._id.toString())) {
            breachRecipients.push(ticket.createdBy._id);
          }

          for (const recipientId of breachRecipients) {
            await sendNotification({
              recipient: recipientId,
              type: 'SLA_BREACH',
              title: 'SLA Breach: Resolution Target Exceeded',
              message: `Ticket ${ticket.ticketId} has exceeded its resolution SLA target.`,
              ticket,
            });

            // Email alert
            sendSLABreachEmail({
              userId: recipientId,
              ticket,
              breachType: 'Resolution',
            }).catch(() => {});
          }

          // Real-time WebSocket emission
          emitToTicket(ticket.ticketId, 'sla:breached', {
            ticketId: ticket.ticketId,
            breachType: 'resolution',
            dueAt: ticket.sla.resolutionDueAt,
            timestamp: new Date(),
          });
          emitToAdmins('sla:breached', {
            ticketId: ticket.ticketId,
            breachType: 'resolution',
            dueAt: ticket.sla.resolutionDueAt,
            timestamp: new Date(),
          });
        }
      }

      // 3. Check Approaching Resolution Deadline Warning (e.g. within 2 hours or < 25% remaining time)
      if (
        ticket.sla.resolutionDueAt &&
        !ticket.sla.resolutionBreached &&
        !ticket.sla.approachingWarningSent
      ) {
        const timeRemainingMs = new Date(ticket.sla.resolutionDueAt).getTime() - now.getTime();
        // Warning triggers when within 2 hours (7,200,000 ms) and not already breached
        if (timeRemainingMs > 0 && timeRemainingMs <= 2 * 60 * 60 * 1000) {
          ticket.sla.approachingWarningSent = true;
          ticketModified = true;

          const warningRecipients = [];
          if (ticket.assignedTo) warningRecipients.push(ticket.assignedTo._id);
          else if (ticket.createdBy) warningRecipients.push(ticket.createdBy._id);

          for (const recipientId of warningRecipients) {
            await sendNotification({
              recipient: recipientId,
              type: 'SLA_WARNING',
              title: 'SLA Warning: Resolution Deadline Approaching',
              message: `Ticket ${ticket.ticketId} is approaching its resolution deadline.`,
              ticket,
            });

            sendSLAWarningEmail({
              userId: recipientId,
              ticket,
              deadlineType: 'Resolution',
              dueAt: ticket.sla.resolutionDueAt,
            }).catch(() => {});
          }

          emitToTicket(ticket.ticketId, 'sla:warning', {
            ticketId: ticket.ticketId,
            deadlineType: 'resolution',
            dueAt: ticket.sla.resolutionDueAt,
            timestamp: new Date(),
          });
        }
      }

      if (ticketModified) {
        await ticket.save();
      }
    }
  } catch (err) {
    console.error('[SLAMonitor] Error executing SLA check routine:', err.message);
  }
};

/**
 * Initialize background cron monitor
 */
const initSLAMonitor = () => {
  if (process.env.SLA_MONITOR_ENABLED === 'false') {
    console.log('[SLAMonitor] Background SLA monitor disabled by configuration.');
    return;
  }

  const intervalMinutes = parseInt(process.env.SLA_MONITOR_INTERVAL_MINUTES, 10) || 1;
  const cronExpression = `*/${intervalMinutes} * * * *`;

  console.log(`[SLAMonitor] Starting SLA monitor on schedule: ${cronExpression}`);

  cronTask = cron.schedule(cronExpression, async () => {
    await checkSLABreaches();
  });
};

const stopSLAMonitor = () => {
  if (cronTask) {
    cronTask.stop();
    cronTask = null;
  }
};

module.exports = {
  checkSLABreaches,
  initSLAMonitor,
  stopSLAMonitor,
};
