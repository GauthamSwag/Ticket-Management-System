const nodemailer = require('nodemailer');
const User = require('../models/User');

let transporter = null;

const getTransporter = () => {
  if (transporter) return transporter;

  const isEnabled = process.env.EMAIL_NOTIFICATIONS_ENABLED === 'true';
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASSWORD;

  if (!isEnabled || !host) {
    return null;
  }

  try {
    transporter = nodemailer.createTransport({
      host,
      port: parseInt(process.env.SMTP_PORT, 10) || 587,
      secure: parseInt(process.env.SMTP_PORT, 10) === 465,
      auth: user && pass ? { user, pass } : undefined,
    });
    return transporter;
  } catch (err) {
    console.warn('[EmailService] Failed to initialize Nodemailer transporter:', err.message);
    return null;
  }
};

/**
 * Helper to verify user preferences before dispatching an email
 */
const shouldSendEmail = async (userId, emailType) => {
  if (process.env.EMAIL_NOTIFICATIONS_ENABLED !== 'true') {
    return false;
  }

  try {
    const user = await User.findById(userId);
    if (!user || !user.email) return false;

    const prefs = user.notificationPreferences || {};
    if (prefs.emailEnabled === false) return false;

    if (emailType === 'assignment' && prefs.assignmentEmails === false) return false;
    if (emailType === 'status' && prefs.statusChangeEmails === false) return false;
    if (emailType === 'sla' && prefs.slaEmails === false) return false;

    return user.email;
  } catch (err) {
    console.error('[EmailService] Preference check error:', err.message);
    return false;
  }
};

/**
 * Generic safe dispatch helper
 */
const sendMailSafe = async ({ to, subject, html, text }) => {
  const isEnabled = process.env.EMAIL_NOTIFICATIONS_ENABLED === 'true';
  if (!isEnabled) {
    // Graceful disabled behavior
    return { success: true, delivered: false, reason: 'EMAIL_NOTIFICATIONS_DISABLED' };
  }

  const transport = getTransporter();
  if (!transport) {
    return { success: true, delivered: false, reason: 'SMTP_NOT_CONFIGURED' };
  }

  try {
    const from = process.env.EMAIL_FROM || '"TicketFlow Support" <support@ticketflow.internal>';
    const info = await transport.sendMail({
      from,
      to,
      subject,
      text,
      html,
    });
    return { success: true, delivered: true, messageId: info.messageId };
  } catch (err) {
    console.error(`[EmailService] Failed sending to ${to}:`, err.message);
    // Never throw or crash the main API
    return { success: false, delivered: false, error: err.message };
  }
};

/**
 * 1. Ticket Assignment Email
 */
const sendTicketAssignmentEmail = async ({ agentId, ticket, assignedBy }) => {
  try {
    const recipientEmail = await shouldSendEmail(agentId, 'assignment');
    if (!recipientEmail) return { success: true, skipped: true };

    const subject = `[TicketFlow] Ticket Assigned: ${ticket.ticketId} - ${ticket.title}`;
    const html = `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #1e293b;">
        <h2 style="color: #6366f1;">New Ticket Assignment</h2>
        <p>You have been assigned to support ticket <strong>${ticket.ticketId}</strong>.</p>
        <div style="background: #f8fafc; border-left: 4px solid #6366f1; padding: 15px; margin: 15px 0;">
          <p><strong>Title:</strong> ${ticket.title}</p>
          <p><strong>Priority:</strong> ${ticket.priority}</p>
          <p><strong>Category:</strong> ${ticket.category}</p>
          <p><strong>Assigned By:</strong> ${assignedBy?.name || 'Administrator'}</p>
        </div>
        <p>Please log in to your dashboard to review and manage this ticket.</p>
      </div>
    `;

    return await sendMailSafe({
      to: recipientEmail,
      subject,
      html,
      text: `You have been assigned to ticket ${ticket.ticketId}: ${ticket.title}. Priority: ${ticket.priority}`,
    });
  } catch (err) {
    console.error('[EmailService] sendTicketAssignmentEmail error:', err.message);
    return { success: false, error: err.message };
  }
};

/**
 * 2. Status Change Email
 */
const sendStatusChangeEmail = async ({ userId, ticket, oldStatus, newStatus, changedBy }) => {
  try {
    const recipientEmail = await shouldSendEmail(userId, 'status');
    if (!recipientEmail) return { success: true, skipped: true };

    const subject = `[TicketFlow] Status Update: ${ticket.ticketId} is now ${newStatus}`;
    const html = `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #1e293b;">
        <h2 style="color: #0284c7;">Ticket Status Updated</h2>
        <p>The status of your ticket <strong>${ticket.ticketId}</strong> has been updated.</p>
        <div style="background: #f0f9ff; border-left: 4px solid #0284c7; padding: 15px; margin: 15px 0;">
          <p><strong>Status Changed:</strong> <span style="text-decoration: line-through; color: #64748b;">${oldStatus}</span> &rarr; <strong style="color: #0284c7;">${newStatus}</strong></p>
          <p><strong>Updated By:</strong> ${changedBy?.name || 'Support Staff'}</p>
          <p><strong>Title:</strong> ${ticket.title}</p>
        </div>
      </div>
    `;

    return await sendMailSafe({
      to: recipientEmail,
      subject,
      html,
      text: `Ticket ${ticket.ticketId} status changed from ${oldStatus} to ${newStatus}.`,
    });
  } catch (err) {
    console.error('[EmailService] sendStatusChangeEmail error:', err.message);
    return { success: false, error: err.message };
  }
};

/**
 * 3. SLA Warning Email
 */
const sendSLAWarningEmail = async ({ userId, ticket, deadlineType, dueAt }) => {
  try {
    const recipientEmail = await shouldSendEmail(userId, 'sla');
    if (!recipientEmail) return { success: true, skipped: true };

    const formattedDate = dueAt ? new Date(dueAt).toLocaleString() : 'Soon';
    const subject = `[TicketFlow] SLA WARNING: ${ticket.ticketId} approaching ${deadlineType} deadline`;
    const html = `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #1e293b;">
        <h2 style="color: #f59e0b;">⚠️ SLA Deadline Approaching</h2>
        <p>Ticket <strong>${ticket.ticketId}</strong> is nearing its ${deadlineType} deadline.</p>
        <div style="background: #fffbeb; border-left: 4px solid #f59e0b; padding: 15px; margin: 15px 0;">
          <p><strong>Title:</strong> ${ticket.title}</p>
          <p><strong>Priority:</strong> ${ticket.priority}</p>
          <p><strong>Deadline Target:</strong> ${formattedDate}</p>
        </div>
        <p>Immediate action is recommended to maintain compliance with SLA standards.</p>
      </div>
    `;

    return await sendMailSafe({
      to: recipientEmail,
      subject,
      html,
      text: `SLA Warning for ticket ${ticket.ticketId}: Approaching ${deadlineType} deadline due at ${formattedDate}.`,
    });
  } catch (err) {
    console.error('[EmailService] sendSLAWarningEmail error:', err.message);
    return { success: false, error: err.message };
  }
};

/**
 * 4. SLA Breach Email
 */
const sendSLABreachEmail = async ({ userId, ticket, breachType }) => {
  try {
    const recipientEmail = await shouldSendEmail(userId, 'sla');
    if (!recipientEmail) return { success: true, skipped: true };

    const subject = `[TicketFlow] SLA BREACH: ${ticket.ticketId} exceeded ${breachType} target`;
    const html = `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #1e293b;">
        <h2 style="color: #ef4444;">🚨 SLA Target Breached</h2>
        <p>Ticket <strong>${ticket.ticketId}</strong> has breached its <strong>${breachType}</strong> SLA target.</p>
        <div style="background: #fef2f2; border-left: 4px solid #ef4444; padding: 15px; margin: 15px 0;">
          <p><strong>Title:</strong> ${ticket.title}</p>
          <p><strong>Priority:</strong> ${ticket.priority}</p>
          <p><strong>Status:</strong> ${ticket.status}</p>
        </div>
        <p>Please prioritize this incident immediately.</p>
      </div>
    `;

    return await sendMailSafe({
      to: recipientEmail,
      subject,
      html,
      text: `SLA Breach alert for ticket ${ticket.ticketId}: ${breachType} target has been breached.`,
    });
  } catch (err) {
    console.error('[EmailService] sendSLABreachEmail error:', err.message);
    return { success: false, error: err.message };
  }
};

module.exports = {
  getTransporter,
  sendTicketAssignmentEmail,
  sendStatusChangeEmail,
  sendSLAWarningEmail,
  sendSLABreachEmail,
  sendMailSafe,
};
