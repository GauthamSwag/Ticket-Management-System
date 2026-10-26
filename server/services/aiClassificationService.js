const { CATEGORIES, PRIORITIES } = require('../models/Ticket');

/**
 * Intelligent semantic analyzer and classifier for ticket title & description
 */
const analyzeTicketContent = (title = '', description = '') => {
  const content = `${title} ${description}`.toLowerCase();

  // Keyword associations
  const categoryKeywords = {
    'Network': ['network', 'wifi', 'wi-fi', 'vpn', 'dns', 'router', 'gateway', 'firewall', 'packet', 'bandwidth', 'ip address', 'connectivity'],
    'Hardware': ['printer', 'laptop', 'monitor', 'keyboard', 'mouse', 'hardware', 'motherboard', 'screen', 'cable', 'docking station'],
    'Billing': ['invoice', 'bill', 'billing', 'charge', 'payment', 'refund', 'receipt', 'subscription', 'credit card', 'pricing'],
    'Account Issue': ['login', 'log in', 'password', 'sign in', 'account', '2fa', 'mfa', 'locked out', 'reset password', 'credential'],
    'Software': ['install', 'update', 'patch', 'software', 'application', 'browser', 'operating system', 'os', 'app crash'],
    'Technical Issue': ['bug', 'error', 'exception', 'stack trace', 'server', 'database', 'api', 'query', 'latency', '500', 'crash', 'timeout'],
  };

  const priorityKeywords = {
    'Critical': ['critical', 'urgent', 'emergency', 'outage', 'down', 'production', 'security breach', 'data loss', 'immediate', 'sev-1', 'sev 1'],
    'High': ['high priority', 'major', 'slow', 'failing', 'blocking', 'broken', 'important', 'serious'],
    'Low': ['minor', 'trivial', 'low priority', 'typo', 'cosmetic', 'suggestion', 'enhancement'],
  };

  // Determine category score
  let detectedCategory = 'Technical Issue';
  let maxCatScore = 0;

  for (const [cat, keywords] of Object.entries(categoryKeywords)) {
    let score = 0;
    for (const kw of keywords) {
      if (content.includes(kw)) score += 1;
    }
    if (score > maxCatScore) {
      maxCatScore = score;
      detectedCategory = cat;
    }
  }

  // Determine priority score
  let detectedPriority = 'Medium';
  let maxPrioScore = 0;

  for (const [prio, keywords] of Object.entries(priorityKeywords)) {
    let score = 0;
    for (const kw of keywords) {
      if (content.includes(kw)) score += 1;
    }
    if (score > maxPrioScore) {
      maxPrioScore = score;
      detectedPriority = prio;
    }
  }

  // Compute confidence (range 0.65 to 0.95)
  const baseConfidence = 0.65;
  const matchBonus = Math.min((maxCatScore + maxPrioScore) * 0.08, 0.30);
  const confidence = parseFloat((baseConfidence + matchBonus).toFixed(2));

  // Ensure validity
  const validCategory = CATEGORIES.includes(detectedCategory) ? detectedCategory : 'Other';
  const validPriority = PRIORITIES.includes(detectedPriority) ? detectedPriority : 'Medium';

  return {
    category: validCategory,
    priority: validPriority,
    confidence,
  };
};

/**
 * Main classification method
 */
const classifyTicket = async ({ title, description }) => {
  const isEnabled = process.env.AI_CLASSIFICATION_ENABLED === 'true';

  if (!isEnabled) {
    return {
      available: false,
      message: 'AI classification is disabled in system configuration.',
      suggestion: null,
    };
  }

  try {
    // If external AI key is provided, could call external LLM here with graceful fallback
    const suggestion = analyzeTicketContent(title, description);

    return {
      available: true,
      suggestion,
    };
  } catch (err) {
    console.error('[AIClassificationService] Error during classification:', err.message);
    return {
      available: false,
      message: 'Classification engine encountered an internal error.',
      suggestion: null,
    };
  }
};

module.exports = {
  classifyTicket,
  analyzeTicketContent,
};
