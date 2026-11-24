/**
 * Urgency Scorer - Rule-based urgency used when the AI is unavailable.
 *
 * Urgency depends on what the customer is affected by, not on punctuation,
 * message length, tone, or the time of day.
 */

const BASE_URGENCY = {
  "Technical Problem": "Medium",
  "Billing Issue": "Medium",
  "Feature Request": "Low",
  "General Inquiry": "Low",
  "Positive Feedback": "Low",
  "Unknown": "Medium"
}

// "Server down", "site is down", "everything went down" (but not "slow down" or "download")
export const DOWN_PATTERN = /\b(servers?|site|website|app|apps|service|services|system|systems|database|db|api|platform|everything|portal|checkout|login|network)( is| are| was| went| goes| has gone| seems| appears to be)? (completely |totally )?down\b|\b(is|are|was|went|goes|has gone) (completely |totally )?down\b|\bdowntime\b/

// "Database connection lost", "lost connection", "keeps disconnecting"
export const CONNECTION_LOST_PATTERN = /\b(connection|database|db) (was |is |has been )?(lost|dropped|refused|failed|down)\b|\b(lost|losing|no) connection\b|\bdisconnect(ed|ing|s)?\b/

// A plan change needs both the verb and a plan noun close together, so
// "upgrade the editor to support markdown" stays a feature request.
export const PLAN_CHANGE = /\b(upgrad(e|ing)|downgrad(e|ing)|cancel(l?ing)?|switch(ing)?|chang(e|ing)|renew(ing)?)\b(\s+[\w'-]+){0,4}?\s+(plan|subscription|tier|membership|license|seats?)\b|\b(upgrad(e|ing)|downgrad(e|ing))\s+to\s+(the\s+)?(pro|premium|business|enterprise|team|basic|starter|annual|monthly)\b|\bcancel(l?ing)?\s+(my|our|the)\s+account\b/i

// Signals that a customer is blocked or that something is broken for everyone
const HIGH_SIGNALS = [
  { pattern: DOWN_PATTERN, label: 'service down' },
  { pattern: CONNECTION_LOST_PATTERN, label: 'connection lost' },
  { pattern: /\boutages?\b/, label: 'outage' },
  { pattern: /\bproduction\b/, label: 'production' },
  { pattern: /\b(can't|cannot|unable to) (log ?in|sign ?in|access|use)\b/, label: "can't access" },
  { pattern: /\bdata loss\b|\b(lost|deleted|missing) (all )?(my|our|the) (data|files|records)\b/, label: 'data loss' },
  { pattern: /\b(security|breach(ed)?|hacked|unauthorized|compromised)\b/, label: 'security concern' },
  { pattern: /\bpayment (failed|declined)\b|\bcharged (twice|double)\b|\b(double|over)[- ]?charged\b/, label: 'payment problem' },
]

// Explicit urgency words from the customer
const URGENT_WORDS = /\b(urgent(ly)?|asap|emergency|critical|immediately)\b/

/**
 * @param {string} message - The customer message
 * @param {string} category - The message category
 * @returns {{urgency: 'High'|'Medium'|'Low', reasoning: string}}
 */
export function calculateUrgency(message, category) {
  const text = message.toLowerCase().replace(/[‘’]/g, "'")
  const base = BASE_URGENCY[category] || "Medium"

  // Praise is never urgent
  if (category === "Positive Feedback") {
    return { urgency: "Low", reasoning: "The customer is giving positive feedback; nothing needs fixing." }
  }

  const urgentWord = text.match(URGENT_WORDS)?.[0]

  // Requests and questions only become more urgent when the customer says so
  if (base === "Low") {
    if (urgentWord) {
      return { urgency: "Medium", reasoning: `The customer marked this as '${urgentWord}', so it is raised above a routine ${category.toLowerCase()}.` }
    }
    return { urgency: "Low", reasoning: `A ${category.toLowerCase()} is not time-sensitive unless the customer is blocked.` }
  }

  const signals = HIGH_SIGNALS.filter(({ pattern }) => pattern.test(text)).map(s => s.label)
  if (urgentWord) signals.push(`'${urgentWord}'`)

  if (signals.length > 0) {
    return { urgency: "High", reasoning: `Signals that the customer is blocked or a service is affected: ${signals.join(', ')}.` }
  }

  if (category === "Billing Issue" && PLAN_CHANGE.test(text)) {
    return { urgency: "Low", reasoning: "A routine plan change request is not time-sensitive." }
  }

  return { urgency: base, reasoning: `A ${category.toLowerCase()} with no sign that the customer is blocked, so it is treated as ${base.toLowerCase()} priority.` }
}
