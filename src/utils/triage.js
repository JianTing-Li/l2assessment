import { categorizeMessage } from './llmHelper'
import { extractIds, runWithLimit } from './extract'
import { correctionExamples } from './corrections'
import { triageContext } from './settings'
import { makeId } from './storage'

/** Fire-and-forget Slack alert; the server ignores it when no webhook is set. */
function sendAlert(entry) {
  fetch('/api/alert', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: entry.message,
      category: entry.category,
      urgency: entry.urgency,
      routeTo: entry.routeTo,
      recommendedAction: entry.recommendedAction,
    }),
  }).catch(() => {})
}

/** Analyze one message and build the history entry for it. */
export async function triageMessage(message, settings, history, { signal } = {}) {
  const { categories, actionFor, routeFor } = triageContext(settings)
  const analysis = await categorizeMessage(message, {
    categories,
    actionFor,
    examples: correctionExamples(history),
    signal,
  })
  const entry = {
    ...analysis,
    id: makeId(),
    status: 'Open',
    message,
    routeTo: routeFor(analysis.category),
    extractedIds: extractIds(message),
    timestamp: new Date().toISOString(),
  }
  if (entry.urgency === 'High' && settings.alertsEnabled) sendAlert(entry)
  return entry
}

/** Analyze several messages, three at a time to stay inside Groq's rate limits. */
export function triageBatch(messages, settings, history, { onProgress, signal } = {}) {
  let done = 0
  return runWithLimit(
    messages,
    3,
    message => triageMessage(message, settings, history, { signal }),
    () => onProgress?.(++done, messages.length)
  )
}
