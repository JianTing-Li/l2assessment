import Groq from 'groq-sdk';
import { calculateUrgency } from './urgencyScorer';
import { getRecommendedAction } from './templates';

/**
 * LLM Helper for analyzing customer support messages
 * Using Groq API for AI-powered categorization, urgency and recommended action
 */

// Initialize Groq client lazily: the SDK throws if the key is missing, which
// would crash the whole app at import time.
let groq = null;
function getGroqClient() {
  if (!groq) {
    groq = new Groq({
      apiKey: import.meta.env.VITE_GROQ_API_KEY,
      dangerouslyAllowBrowser: true // Required for browser-based calls (not recommended for production!)
    });
  }
  return groq;
}

const URGENCY_LEVELS = ['High', 'Medium', 'Low'];
const PLAN_CHANGE = /\b(upgrade|upgrading|downgrade|downgrading|cancel(l?ing)? (my|our|the)? ?(account|subscription|plan))\b/i;

const SYSTEM_PROMPT = `You triage customer support messages for a support team. Reply in exactly this format:
Category: <one of: Billing Issue, Technical Problem, Feature Request, General Inquiry, Positive Feedback>
Category reasoning: <one or two sentences explaining why>
Urgency: <High, Medium, or Low>
Urgency reasoning: <one or two sentences explaining why>
Recommended action: <one sentence telling the support team what to do next>

Category guide:
- Billing Issue: payments, charges, invoices, refunds, and plan or subscription changes such as upgrades, downgrades and cancellations. Asking to upgrade or change a plan is a Billing Issue, never a Feature Request.
- Technical Problem: bugs, errors, slowness, or anything not working.
- Feature Request: asks for a new capability or improvement to the product itself (not plans or pricing).
- General Inquiry: a question that is not about billing or a problem.
- Positive Feedback: thanks or praise with no request.

Urgency guide:
- High: an outage or production system down, the customer cannot access or use the product, data loss, a security issue, or a payment failure that blocks access.
- Medium: degraded performance, non-blocking bugs, or billing errors that do not block access.
- Low: feature requests, general questions, routine plan or upgrade requests, and praise.
Punctuation, tone, message length and time of day must not affect urgency.`;

/**
 * Analyze a customer support message using Groq AI
 *
 * @param {string} message - The customer support message
 * @returns {Promise<{category: string, reasoning: string, urgency: string, urgencyReasoning: string, recommendedAction: string, usedFallback: boolean}>}
 */
export async function categorizeMessage(message) {
  try {
    const response = await getGroqClient().chat.completions.create({
      model: "allam-2-7b", // Most generous Groq free tier available on this account (7,000 requests/day)
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: `Triage this customer support message: ${message}` }
      ],
      temperature: 0.2,
      max_tokens: 400,
    });

    return { ...parseAiResponse(response.choices[0].message.content, message), usedFallback: false };
  } catch (error) {
    console.warn('Groq API failed, using keyword fallback:', error.message);
    return { ...getKeywordAnalysis(message), usedFallback: true };
  }
}

/**
 * Parse the labeled lines of the AI reply. Any field that is missing or invalid
 * is filled in from the keyword rules so the UI never shows an empty field.
 */
function parseAiResponse(content, message) {
  const fields = {};
  let current = null;
  for (const line of content.split('\n')) {
    const labeled = line.match(/^\W*(category reasoning|reasoning|category|urgency reasoning|urgency|recommended action)\s*:\s*(.*)$/i);
    if (labeled) {
      current = labeled[1].toLowerCase();
      // Smaller models often use a bare "Reasoning:" label for both reasonings, in order
      if (current === 'reasoning') {
        current = fields['category reasoning'] === undefined ? 'category reasoning' : 'urgency reasoning';
      }
      fields[current] = labeled[2];
    } else if (current && current !== 'category' && current !== 'urgency' && line.trim()) {
      fields[current] += ' ' + line.trim();
    }
  }
  const clean = value => value?.replace(/^[\s*_]+|[\s*_]+$/g, '') || '';

  const categoryText = clean(fields.category).toLowerCase();
  const category = Object.keys(CATEGORY_RULES).find(name => categoryText.includes(name.toLowerCase()));
  const urgency = URGENCY_LEVELS.find(level => clean(fields.urgency).toLowerCase().startsWith(level.toLowerCase()));

  const fallback = getKeywordAnalysis(message);

  // Business rule: plan changes are billing, even if a small model files them elsewhere
  if (PLAN_CHANGE.test(message) && category !== 'Billing Issue' && category !== 'Technical Problem') {
    const planUrgency = calculateUrgency(message, 'Billing Issue');
    return {
      category: 'Billing Issue',
      reasoning: 'Upgrading, downgrading or cancelling a plan is handled as a billing request.',
      urgency: planUrgency.urgency === 'High' ? 'High' : 'Low',
      urgencyReasoning: planUrgency.urgency === 'High' ? planUrgency.reasoning : 'A routine plan change request is not time-sensitive.',
      recommendedAction: getRecommendedAction('Billing Issue', planUrgency.urgency),
    };
  }

  const finalCategory = category ?? fallback.category;
  const finalUrgency = urgency ?? calculateUrgency(message, finalCategory).urgency;

  return {
    category: finalCategory,
    reasoning: clean(fields['category reasoning']) || (category ? content : fallback.reasoning),
    urgency: finalUrgency,
    urgencyReasoning: clean(fields['urgency reasoning']) || calculateUrgency(message, finalCategory).reasoning,
    recommendedAction: clean(fields['recommended action']) || getRecommendedAction(finalCategory, finalUrgency),
  };
}

/**
 * Keyword rules per category. Each rule is a whole-word regex with a weight:
 * phrases weigh more than single words, so "payment failed" outranks a lone "issue".
 */
const CATEGORY_RULES = {
  "Billing Issue": [
    { pattern: /\bpayment (failed|declined|issue|problem)/, weight: 3 },
    { pattern: /\b(double|over)[- ]?charged\b/, weight: 2 },
    { pattern: /\bcredit card\b/, weight: 2 },
    { pattern: /\bcancel(l?ing)? (my|our|the)? ?(account|subscription|plan)\b/, weight: 2 },
    { pattern: /\b(upgrade|upgrading|downgrade|downgrading)\b/, weight: 2 },
    { pattern: /\bbill(s|ed|ing)?\b/, weight: 1 },
    { pattern: /\bpayments?\b/, weight: 1 },
    { pattern: /\bcharg(e|es|ed|ing)\b/, weight: 1 },
    { pattern: /\binvoices?\b/, weight: 1 },
    { pattern: /\brefunds?\b/, weight: 1 },
    { pattern: /\bsubscriptions?\b/, weight: 1 },
    { pattern: /\bplans?\b/, weight: 1 },
    { pattern: /\breceipts?\b/, weight: 1 },
    { pattern: /\bpric(e|es|ing)\b/, weight: 1 },
  ],
  "Technical Problem": [
    { pattern: /\bnot working\b/, weight: 2 },
    { pattern: /\b(can't|cannot|unable to) (log ?in|sign ?in|access|load|open)\b/, weight: 2 },
    { pattern: /\b(doesn't|does not|won't|will not) (work|load|open)\b/, weight: 2 },
    { pattern: /\b(is|are|was|went) down\b/, weight: 2 },
    { pattern: /\bbugs?\b/, weight: 1 },
    { pattern: /\berrors?\b/, weight: 1 },
    { pattern: /\bbroken\b/, weight: 1 },
    { pattern: /\bcrash(es|ed|ing)?\b/, weight: 1 },
    { pattern: /\boutages?\b/, weight: 1 },
    { pattern: /\bservers?\b/, weight: 1 },
    { pattern: /\bproduction\b/, weight: 1 },
    { pattern: /\bslow(ly)?\b/, weight: 1 },
    { pattern: /\bloading\b/, weight: 1 },
    { pattern: /\bfreez(e|es|ing)\b|\bfrozen\b/, weight: 1 },
    { pattern: /\bglitch(es)?\b/, weight: 1 },
    { pattern: /\bfail(s|ed|ing|ure)?\b/, weight: 1 },
    { pattern: /\bissues?\b/, weight: 1 },
    { pattern: /(?<!no )\bproblems?\b/, weight: 1 },
  ],
  "Feature Request": [
    { pattern: /\b(can|could|would) you (please )?add\b/, weight: 2 },
    { pattern: /\bplease add\b/, weight: 2 },
    { pattern: /\bwould (like to see|love to see|be great|be nice)\b/, weight: 2 },
    { pattern: /\bfeatures?\b/, weight: 1 },
    { pattern: /\bsuggest(ion|ions|ed)?\b/, weight: 1 },
    { pattern: /\bimprove(ment|ments)?\b/, weight: 1 },
    { pattern: /\benhancements?\b/, weight: 1 },
    { pattern: /\bwish\b/, weight: 1 },
  ],
  "General Inquiry": [
    { pattern: /\b(can i|is there|do you|are there)\b/, weight: 1.5 },
    { pattern: /\b(how|what|when|where|which|why)\b/, weight: 1 },
    { pattern: /\?/, weight: 0.5, label: '?' },
  ],
  "Positive Feedback": [
    // Gratitude only counts when the message isn't a "thanks, but..." complaint
    { pattern: /^(?!.*\b(but|however)\b).*\b(thanks?|thank you|appreciate)\b/, weight: 1, label: 'thanks' },
    { pattern: /\bkeep up the (great|good) work\b/, weight: 2 },
    { pattern: /\b(great|amazing|excellent|awesome|fantastic|wonderful) (job|work|service|support|product)\b/, weight: 2 },
    { pattern: /\b(really |very )?(happy|satisfied|pleased) with\b/, weight: 1 },
    { pattern: /\bi (love|really like) (using|your|the)\b/, weight: 1 },
    { pattern: /\b(amazing|excellent|awesome|fantastic|wonderful)\b/, weight: 1 },
  ],
};

/**
 * Keyword-based fallback used when the AI is unavailable.
 * Scores every category and picks the highest; ties or no matches return
 * "Unknown" (which templates.js maps to manual review) instead of guessing.
 * Urgency and the recommended action come from the rule-based helpers.
 */
function getKeywordAnalysis(message) {
  const { category, reasoning } = getKeywordCategorization(message);
  const { urgency, reasoning: urgencyReasoning } = calculateUrgency(message, category);
  return {
    category,
    reasoning,
    urgency,
    urgencyReasoning,
    recommendedAction: getRecommendedAction(category, urgency)
  };
}

function getKeywordCategorization(message) {
  const text = message.toLowerCase().replace(/[‘’]/g, "'");

  const scored = Object.entries(CATEGORY_RULES).map(([category, rules]) => {
    let score = 0;
    const matches = [];
    for (const { pattern, weight, label } of rules) {
      const match = text.match(pattern);
      if (match) {
        score += weight;
        matches.push(label || match[0].trim());
      }
    }
    return { category, score, matches };
  });

  const best = Math.max(...scored.map(s => s.score));
  const leaders = scored.filter(s => s.score === best);

  if (best === 0) {
    return {
      category: "Unknown",
      reasoning: "No clear keywords matched. Manual review recommended."
    };
  }

  if (leaders.length > 1) {
    return {
      category: "Unknown",
      reasoning: `Mixed signals (${leaders.map(l => l.category).join(', ')}). Manual review recommended.`
    };
  }

  const [winner] = leaders;
  return {
    category: winner.category,
    reasoning: `Matched keywords: ${winner.matches.join(', ')} → ${winner.category}.`
  };
}
