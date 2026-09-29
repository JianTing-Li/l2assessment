/**
 * Recommendation Templates - Maps category and urgency to a recommended action
 * for the support team.
 */

const actionTemplates = {
  "Billing Issue": {
    High: "Escalate to the billing team now: verify the payment status and restore the customer's access.",
    default: "Review the account in the billing system, then reply with the plan or pricing details or a link to the billing portal."
  },
  "Technical Problem": {
    High: "Escalate to on-call engineering immediately and send the customer a status update.",
    default: "Ask the customer for steps to reproduce and any error details, then route to technical support."
  },
  "Feature Request": {
    default: "Log the request in the product feedback tracker and thank the customer."
  },
  "General Inquiry": {
    default: "Answer the question directly or send the relevant FAQ link."
  },
  "Positive Feedback": {
    default: "No action needed. Send a short thank-you and share the feedback with the team."
  },
  "Unknown": {
    default: "Review manually."
  }
}

/**
 * Get recommended action for a given category and urgency
 *
 * @param {string} category - The message category
 * @param {string} urgency - The urgency level
 * @returns {string} - Recommended next step
 */
export function getRecommendedAction(category, urgency) {
  const templates = actionTemplates[category]
  if (!templates) return "No recommendation available."
  return templates[urgency] || templates.default
}

/**
 * Get all available categories
 *
 * @returns {string[]} - List of categories
 */
export function getAvailableCategories() {
  return Object.keys(actionTemplates)
}

/**
 * Determines if message should be escalated
 *
 * @param {string} category - The message category
 * @param {string} urgency - The urgency level
 * @param {string} message - The original message
 * @returns {boolean} - Whether to escalate
 */
export function shouldEscalate(category, urgency, message) {
  return message.length > 100
}
