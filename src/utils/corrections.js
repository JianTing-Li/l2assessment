/**
 * Agent corrections: changing the AI's category or urgency, and measuring how
 * often agents agree with it.
 */

export const URGENCY_RANK = { High: 0, Medium: 1, Low: 2 }

/** Low confidence or an undecided category means a person should check it. */
export function needsReview(entry) {
  return entry.confidence === 'Low' || entry.category === 'Unknown'
}

/**
 * Apply an agent's change of category and/or urgency. Remembers the AI's
 * original answer, and keeps the action and routing in step with the new values.
 */
export function applyCorrection(entry, changes, { actionFor, routeFor }) {
  const original = entry.original ?? {
    category: entry.category,
    urgency: entry.urgency,
    recommendedAction: entry.recommendedAction,
    urgencyReasoning: entry.urgencyReasoning,
  }
  const next = { ...entry, ...changes, original }
  next.corrected = next.category !== original.category || next.urgency !== original.urgency
  next.recommendedAction = next.corrected ? actionFor(next.category, next.urgency) : original.recommendedAction
  next.urgencyReasoning = next.urgency === original.urgency
    ? original.urgencyReasoning
    : `Set to ${next.urgency} by an agent (the AI said ${original.urgency}).`
  next.routeTo = routeFor(next.category)
  if (next.corrected) next.correctedAt = new Date().toISOString()
  return next
}

/** The latest corrections, as worked examples for the AI prompt. */
export function correctionExamples(history, limit = 5) {
  return history
    .filter(item => item.corrected && !item.usedFallback)
    .sort((a, b) => new Date(b.correctedAt || b.timestamp) - new Date(a.correctedAt || a.timestamp))
    .slice(0, limit)
    .map(item => ({ message: item.message.slice(0, 300), category: item.category, urgency: item.urgency }))
}

/**
 * How often agents kept the AI's answer. Only AI results count (not keyword
 * fallback), and only ones an agent has looked at: corrected or moved out of Open.
 */
export function agreementStats(history) {
  const reviewed = history.filter(item => !item.usedFallback && (item.corrected || item.status !== 'Open'))
  const corrected = reviewed.filter(item => item.corrected)
  const byCategory = {}
  for (const item of corrected) {
    const from = item.original?.category ?? item.category
    byCategory[from] = (byCategory[from] || 0) + 1
  }
  return {
    reviewed: reviewed.length,
    corrected: corrected.length,
    keptPercent: reviewed.length ? Math.round(((reviewed.length - corrected.length) / reviewed.length) * 100) : null,
    correctionsByCategory: Object.entries(byCategory)
      .map(([category, count]) => ({ category, count }))
      .sort((a, b) => b.count - a.count),
  }
}
