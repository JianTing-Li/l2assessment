import { useState } from 'react'
import { ConfidenceBadge, CorrectedBadge, ReviewBadge } from './Badges'
import Flash from './Flash'
import { useFlash } from '../hooks/useFlash'
import { FALLBACK_MESSAGES, URGENCY_LEVELS } from '../utils/llmHelper'
import { needsReview } from '../utils/corrections'

async function copyText(text, showFlash, label) {
  try {
    await navigator.clipboard.writeText(text)
    showFlash(`${label} copied`)
  } catch {
    showFlash('Could not copy. Select the text and copy it manually.', 'error')
  }
}

function summaryText(entry) {
  const lines = [
    `Category: ${entry.category}`,
    `Urgency: ${entry.urgency}${entry.urgencyReasoning ? ` (${entry.urgencyReasoning})` : ''}`,
    entry.routeTo && `Route to: ${entry.routeTo}`,
    `Recommendation: ${entry.recommendedAction}`,
    entry.extractedIds?.length && `References: ${entry.extractedIds.join(', ')}`,
  ].filter(Boolean)
  return `${lines.join('\n')}\n\nReasoning: ${entry.reasoning}`
}

function Section({ label, children }) {
  return (
    <div>
      <div className="mb-1 text-sm font-semibold text-gray-600">{label}</div>
      {children}
    </div>
  )
}

function Detail({ label, value }) {
  return (
    <div className="rounded-md border border-gray-200 bg-white px-3 py-2">
      <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">{label}</div>
      <div className="text-sm text-gray-800">{value || <span className="text-gray-400">—</span>}</div>
    </div>
  )
}

/**
 * Full analysis of one message, with controls to correct the category and
 * urgency and to edit the draft reply.
 *
 * Remount it with key={entry.id} so the reply draft resets per message.
 */
export default function AnalysisDetails({ entry, categoryNames, onCorrect, onReplyChange, showMessage = false }) {
  const [reply, setReply] = useState(entry.suggestedReply || '')
  const [flash, showFlash] = useFlash()
  const options = categoryNames.includes(entry.category) ? categoryNames : [...categoryNames, entry.category]
  const selectClass = 'rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-semibold focus:border-blue-500 focus:ring-2 focus:ring-blue-500'

  return (
    <div className="space-y-5">
      {entry.usedFallback && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          ⚠️ AI unavailable: {FALLBACK_MESSAGES[entry.fallbackReason] || 'unknown error.'} This result came from keyword rules and may be less accurate.
        </div>
      )}

      {showMessage && (
        <Section label="Full message">
          <div className="whitespace-pre-wrap rounded border border-gray-200 bg-white p-3 text-sm text-gray-800">{entry.message}</div>
        </Section>
      )}

      <div className="flex flex-wrap items-end gap-4">
        <label className="flex flex-col text-sm font-semibold text-gray-600">
          Category
          <select className={`${selectClass} mt-1 text-blue-800`} value={entry.category} onChange={e => onCorrect({ category: e.target.value })}>
            {options.map(name => <option key={name} value={name}>{name}</option>)}
          </select>
        </label>
        <label className="flex flex-col text-sm font-semibold text-gray-600">
          Urgency
          <select className={`${selectClass} mt-1`} value={entry.urgency} onChange={e => onCorrect({ urgency: e.target.value })}>
            {URGENCY_LEVELS.map(level => <option key={level} value={level}>{level}</option>)}
          </select>
        </label>
        <div className="flex flex-wrap items-center gap-2 pb-2">
          <ConfidenceBadge confidence={entry.confidence} />
          {needsReview(entry) && <ReviewBadge />}
          {entry.corrected && (
            <>
              <CorrectedBadge original={entry.original} />
              <button
                type="button"
                className="text-xs font-semibold text-violet-700 underline hover:text-violet-900"
                onClick={() => onCorrect({ category: entry.original.category, urgency: entry.original.urgency })}
              >
                Undo (AI said {entry.original.category}, {entry.original.urgency})
              </button>
            </>
          )}
        </div>
      </div>
      {entry.urgencyReasoning && <p className="-mt-2 text-sm text-gray-600">{entry.urgencyReasoning}</p>}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="md:col-span-2">
          <Section label="Recommended action">
            <div className="rounded-lg border border-purple-200 bg-purple-50 p-4 text-gray-800">{entry.recommendedAction}</div>
          </Section>
        </div>
        <Section label="Route to">
          <div className="rounded-lg border border-gray-200 bg-white p-4 font-semibold text-gray-800">{entry.routeTo || '—'}</div>
        </Section>
      </div>

      <Section label="Suggested reply">
        {entry.suggestedReply || reply ? (
          <>
            <textarea
              aria-label="Suggested reply"
              value={reply}
              onChange={e => setReply(e.target.value)}
              onBlur={() => reply !== entry.suggestedReply && onReplyChange?.(reply)}
              className="h-32 w-full rounded-lg border border-gray-300 p-3 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
            />
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <button type="button" onClick={() => copyText(reply, showFlash, 'Reply')} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700">
                Copy reply
              </button>
              <span className="text-xs text-gray-500">Edit before sending. Changes are saved to the queue.</span>
            </div>
          </>
        ) : (
          <div className="rounded-lg border border-dashed border-gray-300 p-3 text-sm text-gray-500">
            Draft replies need the AI. Try again once it is available.
          </div>
        )}
      </Section>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Detail label="Sentiment" value={entry.sentiment} />
        <Detail label="Product area" value={entry.productArea} />
        <Detail label="Language" value={entry.language} />
        <Detail label="References" value={entry.extractedIds?.join(', ')} />
      </div>

      <Section label={entry.usedFallback ? 'Keyword match' : 'AI reasoning'}>
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm text-gray-700">{entry.reasoning}</div>
      </Section>

      <div className="flex flex-wrap items-center gap-3 border-t border-gray-200 pt-4">
        <button
          type="button"
          onClick={() => copyText(summaryText(entry), showFlash, 'Summary')}
          className="rounded-lg bg-gray-100 px-4 py-2 font-semibold text-gray-700 hover:bg-gray-200"
        >
          📋 Copy summary
        </button>
        <Flash flash={flash} />
      </div>
    </div>
  )
}
