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

// Signals that a customer is blocked or that something is broken for everyone
const HIGH_SIGNALS = [
  { pattern: /\b(is|are|was|went|goes|has gone) down\b|\bdowntime\b/, label: 'service down' },
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

  return { urgency: base, reasoning: `A ${category.toLowerCase()} with no sign that the customer is blocked, so it is treated as ${base.toLowerCase()} priority.` }
}
