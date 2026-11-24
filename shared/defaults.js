/**
 * Default categories, shared by the browser (settings, templates) and the
 * server (prompt). Teams and actions can be changed on the Settings page.
 */
export const DEFAULT_CATEGORIES = [
  {
    name: 'Billing Issue',
    description: 'payments, charges, invoices, refunds, and plan or subscription changes such as upgrades, downgrades and cancellations. Asking to upgrade or change a plan is a Billing Issue, never a Feature Request.',
    team: 'Billing team',
    actions: {
      High: "Escalate to the billing team now: verify the payment status and restore the customer's access.",
      default: 'Review the account in the billing system, then reply with the plan or pricing details or a link to the billing portal.',
    },
  },
  {
    name: 'Technical Problem',
    description: 'bugs, errors, slowness, outages, or anything not working.',
    team: 'Technical support',
    actions: {
      High: 'Escalate to on-call engineering immediately and send the customer a status update.',
      default: 'Ask the customer for steps to reproduce and any error details, then route to technical support.',
    },
  },
  {
    name: 'Feature Request',
    description: 'asks for a new capability or improvement to the product itself (not plans or pricing).',
    team: 'Product team',
    actions: { default: 'Log the request in the product feedback tracker and thank the customer.' },
  },
  {
    name: 'General Inquiry',
    description: 'a question that is not about billing or a problem.',
    team: 'Support team',
    actions: { default: 'Answer the question directly or send the relevant FAQ link.' },
  },
  {
    name: 'Positive Feedback',
    description: 'thanks or praise with no request.',
    team: 'Support team',
    actions: { default: 'No action needed. Send a short thank-you and share the feedback with the team.' },
  },
]

/** Used when the keyword fallback can't decide. Not offered to the AI. */
export const UNKNOWN_CATEGORY = {
  name: 'Unknown',
  description: '',
  team: 'Triage lead',
  actions: { default: 'Review manually.' },
}

export const BUILT_IN_NAMES = DEFAULT_CATEGORIES.map(c => c.name)
