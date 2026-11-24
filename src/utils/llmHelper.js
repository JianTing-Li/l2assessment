import { calculateUrgency } from './urgencyScorer';
import { getRecommendedAction } from './templates';
import { getKeywordAnalysis, PLAN_CHANGE } from './keywordRules';

/**
 * Client side of the AI triage. The browser calls /api/triage (served by
 * api/triage.js on Vercel or vite.config.js locally); the Groq key stays on the server.
 */

export const URGENCY_LEVELS = ['High', 'Medium', 'Low'];
export const CONFIDENCE_LEVELS = ['High', 'Medium', 'Low'];
export const SENTIMENTS = ['Angry', 'Frustrated', 'Neutral', 'Positive'];

export const DEFAULT_CATEGORY_NAMES = ['Billing Issue', 'Technical Problem', 'Feature Request', 'General Inquiry', 'Positive Feedback'];

/** Why the keyword fallback was used, in words an agent can act on. */
export const FALLBACK_MESSAGES = {
  missing_key: 'No Groq API key is set on the server. Add GROQ_API_KEY to .env.local (or your Vercel project) and restart.',
  invalid_key: 'The Groq API key was rejected. Check GROQ_API_KEY.',
  rate_limited: 'The Groq free-tier rate limit was hit. Wait a minute and try again.',
  model_unavailable: 'The configured Groq model is not available on this account. Set GROQ_MODEL to one listed at console.groq.com.',
  ai_unreachable: 'The server could not reach Groq.',
  ai_error: 'The AI returned an error.',
  unparseable: 'The AI reply could not be read.',
  network: 'The app could not reach its own /api/triage endpoint.',
};

/**
 * Analyze a customer support message.
 *
 * @param {string} message
 * @param {{categories?: {name: string, description?: string}[], examples?: object[], actionFor?: Function, signal?: AbortSignal}} options
 * @returns {Promise<object>} analysis, with usedFallback and fallbackReason
 */
export async function categorizeMessage(message, options = {}) {
  const { categories, examples, actionFor = getRecommendedAction, signal } = options;
  const categoryNames = categories?.length ? categories.map(c => c.name) : DEFAULT_CATEGORY_NAMES;
  const fallback = reason => ({ ...getKeywordAnalysis(message, actionFor), usedFallback: true, fallbackReason: reason });

  let response;
  try {
    response = await fetch('/api/triage', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, categories, examples }),
      signal,
    });
  } catch (error) {
    if (error.name === 'AbortError') throw error;
    return fallback('network');
  }

  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    console.warn('AI triage unavailable, using keyword fallback:', body.error, body.detail || '');
    return fallback(FALLBACK_MESSAGES[body.error] ? body.error : 'ai_error');
  }

  const parsed = parseAiResponse(body.content, message, { categoryNames, actionFor });
  if (!parsed) return fallback('unparseable');
  return { ...parsed, model: body.model, usedFallback: false, fallbackReason: null };
}

/** Read a JSON object out of the model's reply, tolerating code fences or extra text. */
function readJson(content) {
  if (typeof content !== 'string') return null;
  try {
    return JSON.parse(content);
  } catch {
    const match = content.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      return JSON.parse(match[0]);
    } catch {
      return null;
    }
  }
}

const text = value => (typeof value === 'string' ? value.trim() : '');
const pick = (value, allowed) => allowed.find(option => option.toLowerCase() === text(value).toLowerCase());

/**
 * Turn the AI's JSON into an analysis. Missing or invalid fields are filled in
 * from the keyword rules so the UI never shows an empty field. Returns null
 * when the reply isn't JSON at all.
 */
export function parseAiResponse(content, message, { categoryNames = DEFAULT_CATEGORY_NAMES, actionFor = getRecommendedAction } = {}) {
  const data = readJson(content);
  if (!data || typeof data !== 'object') return null;

  const category = pick(data.category, categoryNames)
    // Tolerate "Billing" for "Billing Issue" and similar
    ?? categoryNames.find(name => text(data.category) && name.toLowerCase().includes(text(data.category).toLowerCase()));
  const urgency = pick(data.urgency, URGENCY_LEVELS);
  const keyword = getKeywordAnalysis(message, actionFor);

  const extras = {
    confidence: pick(data.confidence, CONFIDENCE_LEVELS) ?? 'Medium',
    sentiment: pick(data.sentiment, SENTIMENTS) ?? keyword.sentiment,
    productArea: text(data.productArea).slice(0, 60),
    language: text(data.language).slice(0, 30),
    suggestedReply: text(data.suggestedReply),
  };

  // Business rule: plan changes are billing, even if the model files them elsewhere
  if (categoryNames.includes('Billing Issue') && PLAN_CHANGE.test(message) && category !== 'Billing Issue' && category !== 'Technical Problem') {
    const planUrgency = calculateUrgency(message, 'Billing Issue');
    const finalUrgency = planUrgency.urgency === 'High' ? 'High' : 'Low';
    return {
      ...extras,
      category: 'Billing Issue',
      reasoning: 'Upgrading, downgrading or cancelling a plan is handled as a billing request.',
      urgency: finalUrgency,
      urgencyReasoning: finalUrgency === 'High' ? planUrgency.reasoning : 'A routine plan change request is not time-sensitive.',
      recommendedAction: actionFor('Billing Issue', finalUrgency),
    };
  }

  const finalCategory = category ?? keyword.category;
  const urgencyRule = calculateUrgency(message, finalCategory);
  const finalUrgency = urgency ?? urgencyRule.urgency;

  return {
    ...extras,
    // An answer we had to patch from keyword rules is less trustworthy
    confidence: category && urgency ? extras.confidence : 'Low',
    category: finalCategory,
    reasoning: text(data.categoryReasoning) || (category ? 'The AI did not explain this category.' : keyword.reasoning),
    urgency: finalUrgency,
    urgencyReasoning: (urgency && text(data.urgencyReasoning)) || urgencyRule.reasoning,
    recommendedAction: text(data.recommendedAction) || actionFor(finalCategory, finalUrgency),
  };
}
