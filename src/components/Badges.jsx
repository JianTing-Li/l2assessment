const URGENCY_STYLES = {
  High: 'bg-red-100 text-red-800 ring-red-200',
  Medium: 'bg-yellow-100 text-yellow-900 ring-yellow-200',
  Low: 'bg-green-100 text-green-800 ring-green-200',
}

const STATUS_STYLES = {
  Open: 'bg-blue-50 text-blue-800 ring-blue-200',
  'In progress': 'bg-purple-50 text-purple-800 ring-purple-200',
  Resolved: 'bg-gray-100 text-gray-600 ring-gray-200',
}

const CONFIDENCE_STYLES = {
  High: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
  Medium: 'bg-sky-50 text-sky-800 ring-sky-200',
  Low: 'bg-orange-50 text-orange-800 ring-orange-200',
}

const SENTIMENT_STYLES = {
  Angry: 'bg-red-50 text-red-700 ring-red-200',
  Frustrated: 'bg-orange-50 text-orange-700 ring-orange-200',
  Neutral: 'bg-gray-50 text-gray-700 ring-gray-200',
  Positive: 'bg-green-50 text-green-700 ring-green-200',
}

export function Pill({ children, className = 'bg-gray-100 text-gray-700 ring-gray-200', title }) {
  return (
    <span title={title} className={`inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${className}`}>
      {children}
    </span>
  )
}

export function UrgencyBadge({ urgency, suffix = '' }) {
  return <Pill className={URGENCY_STYLES[urgency]}>{urgency}{suffix}</Pill>
}

export function CategoryBadge({ category }) {
  return <Pill className="bg-blue-50 text-blue-800 ring-blue-200">{category}</Pill>
}

export function StatusBadge({ status }) {
  return <Pill className={STATUS_STYLES[status]}>{status}</Pill>
}

export function ConfidenceBadge({ confidence }) {
  if (!confidence) return null
  return <Pill className={CONFIDENCE_STYLES[confidence]} title="How sure the analysis is">{confidence} confidence</Pill>
}

export function SentimentBadge({ sentiment }) {
  if (!sentiment) return null
  return <Pill className={SENTIMENT_STYLES[sentiment]}>{sentiment}</Pill>
}

export function ReviewBadge() {
  return <Pill className="bg-orange-100 text-orange-900 ring-orange-300" title="Low confidence or unclear category">Needs review</Pill>
}

export function FallbackBadge() {
  return <Pill className="bg-amber-100 text-amber-900 ring-amber-300" title="AI was unavailable; keyword rules were used">Keyword fallback</Pill>
}

export function CorrectedBadge({ original }) {
  const title = original ? `AI said: ${original.category}, ${original.urgency}` : undefined
  return <Pill className="bg-violet-50 text-violet-800 ring-violet-200" title={title}>Corrected</Pill>
}
