import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import AnalysisDetails from '../components/AnalysisDetails'
import { CategoryBadge, UrgencyBadge, ConfidenceBadge, ReviewBadge, FallbackBadge, CorrectedBadge } from '../components/Badges'
import { loadHistory, clearHistory, deleteHistoryEntry, updateHistoryEntry } from '../utils/storage'
import { loadSettings, triageContext } from '../utils/settings'
import { applyCorrection, needsReview, URGENCY_RANK } from '../utils/corrections'

const STATUSES = ['Open', 'In progress', 'Resolved']

const STATUS_TABS = [
  { id: 'active', label: 'Active', match: item => item.status !== 'Resolved' },
  { id: 'Open', label: 'Open', match: item => item.status === 'Open' },
  { id: 'In progress', label: 'In progress', match: item => item.status === 'In progress' },
  { id: 'Resolved', label: 'Resolved', match: item => item.status === 'Resolved' },
  { id: 'all', label: 'All', match: () => true },
]

const SORTS = {
  urgent: (a, b) => URGENCY_RANK[a.urgency] - URGENCY_RANK[b.urgency] || new Date(b.timestamp) - new Date(a.timestamp),
  newest: (a, b) => new Date(b.timestamp) - new Date(a.timestamp),
  oldest: (a, b) => new Date(a.timestamp) - new Date(b.timestamp),
}

const STATUS_SELECT_STYLES = {
  Open: 'border-blue-300 bg-blue-50 text-blue-800',
  'In progress': 'border-purple-300 bg-purple-50 text-purple-800',
  Resolved: 'border-gray-300 bg-gray-100 text-gray-600',
}

const truncate = (text, length) => (text.length > length ? `${text.slice(0, length).trimEnd()}…` : text)

function HistoryPage() {
  const [settings] = useState(loadSettings)
  const context = triageContext(settings)
  const categoryNames = settings.categories.map(c => c.name)

  const [history, setHistory] = useState(loadHistory)
  const [statusTab, setStatusTab] = useState('active')
  const [category, setCategory] = useState('all')
  const [urgency, setUrgency] = useState('all')
  const [reviewOnly, setReviewOnly] = useState(false)
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState('urgent')
  const [expandedId, setExpandedId] = useState(null)

  const tab = STATUS_TABS.find(t => t.id === statusTab)
  const query = search.trim().toLowerCase()

  const visible = useMemo(() => history
    .filter(tab.match)
    .filter(item => category === 'all' || item.category === category)
    .filter(item => urgency === 'all' || item.urgency === urgency)
    .filter(item => !reviewOnly || needsReview(item))
    .filter(item => !query || [item.message, item.suggestedReply, item.productArea, ...(item.extractedIds || [])]
      .some(value => value?.toLowerCase().includes(query)))
    .sort(SORTS[sort]), [history, tab, category, urgency, reviewOnly, query, sort])

  const categories = [...new Set([...categoryNames, ...history.map(item => item.category)])]
    .filter(name => history.some(item => item.category === name))

  const replace = next => setHistory(list => list.map(item => (item.id === next.id ? next : item)))

  const setStatus = (item, status) => {
    updateHistoryEntry(item.id, { status })
    replace({ ...item, status })
  }

  const correct = (item, changes) => {
    const next = applyCorrection(item, changes, context)
    updateHistoryEntry(item.id, next)
    replace(next)
  }

  const saveReply = (item, suggestedReply) => {
    updateHistoryEntry(item.id, { suggestedReply })
    replace({ ...item, suggestedReply })
  }

  const remove = item => {
    if (!window.confirm('Delete this message from the queue?')) return
    setHistory(deleteHistoryEntry(item.id))
  }

  const removeAll = () => {
    if (!window.confirm(`Delete all ${history.length} messages? This cannot be undone.`)) return
    clearHistory()
    setHistory([])
  }

  const filtersActive = category !== 'all' || urgency !== 'all' || reviewOnly || query
  const selectClass = 'rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500'

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="mx-auto max-w-6xl px-4">
        <div className="mb-6 rounded-lg bg-white p-6 shadow-md">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Queue</h1>
              <p className="text-gray-600">Work through analyzed messages, most urgent first.</p>
            </div>
            {history.length > 0 && (
              <button type="button" onClick={removeAll} className="rounded-lg border border-red-300 px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-50">
                Delete all
              </button>
            )}
          </div>

          {history.length > 0 && (
            <>
              <div role="tablist" className="mb-4 flex flex-wrap gap-2">
                {STATUS_TABS.map(t => (
                  <button
                    key={t.id}
                    type="button"
                    role="tab"
                    aria-selected={statusTab === t.id}
                    onClick={() => setStatusTab(t.id)}
                    className={`rounded-lg px-4 py-2 text-sm font-semibold ${statusTab === t.id ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
                  >
                    {t.label} ({history.filter(t.match).length})
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
                <input
                  type="search"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search messages, replies, IDs…"
                  aria-label="Search"
                  className={`${selectClass} lg:col-span-2`}
                />
                <select aria-label="Category" value={category} onChange={e => setCategory(e.target.value)} className={selectClass}>
                  <option value="all">All categories</option>
                  {categories.map(name => <option key={name} value={name}>{name}</option>)}
                </select>
                <select aria-label="Urgency" value={urgency} onChange={e => setUrgency(e.target.value)} className={selectClass}>
                  <option value="all">All urgencies</option>
                  {['High', 'Medium', 'Low'].map(level => <option key={level} value={level}>{level}</option>)}
                </select>
                <select aria-label="Sort" value={sort} onChange={e => setSort(e.target.value)} className={selectClass}>
                  <option value="urgent">Most urgent first</option>
                  <option value="newest">Newest first</option>
                  <option value="oldest">Oldest first</option>
                </select>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-4 text-sm">
                <label className="flex items-center gap-2 text-gray-700">
                  <input type="checkbox" checked={reviewOnly} onChange={e => setReviewOnly(e.target.checked)} className="rounded border-gray-300" />
                  Needs review only
                </label>
                {filtersActive && (
                  <button
                    type="button"
                    className="font-semibold text-blue-700 hover:text-blue-900"
                    onClick={() => { setCategory('all'); setUrgency('all'); setReviewOnly(false); setSearch('') }}
                  >
                    Clear filters
                  </button>
                )}
                <span className="ml-auto text-gray-500">{visible.length} shown</span>
              </div>
            </>
          )}
        </div>

        {history.length === 0 ? (
          <div className="rounded-lg bg-white p-12 text-center shadow-md">
            <div className="mb-4 text-5xl" aria-hidden="true">📭</div>
            <div className="mb-2 text-xl text-gray-600">The queue is empty</div>
            <p className="mb-6 text-gray-500">Analyzed messages will appear here.</p>
            <Link to="/analyze" className="inline-block rounded-lg bg-blue-600 px-6 py-3 font-semibold text-white hover:bg-blue-700">
              Analyze a message
            </Link>
          </div>
        ) : visible.length === 0 ? (
          <div className="rounded-lg bg-white p-10 text-center text-gray-600 shadow-md">
            No messages match these filters.
          </div>
        ) : (
          <ul className="space-y-4">
            {visible.map(item => {
              const expanded = expandedId === item.id
              return (
                <li key={item.id} className={`overflow-hidden rounded-lg bg-white shadow-md ${item.status === 'Resolved' ? 'opacity-75' : ''}`}>
                  <div className="flex items-start gap-3 p-4">
                    <button
                      type="button"
                      aria-expanded={expanded}
                      onClick={() => setExpandedId(expanded ? null : item.id)}
                      className="min-w-0 flex-1 text-left"
                    >
                      <div className="mb-1 text-sm text-gray-500">
                        {new Date(item.timestamp).toLocaleString()}
                        {item.routeTo && <> · <span className="font-semibold text-gray-700">{item.routeTo}</span></>}
                      </div>
                      <div className="mb-2 font-medium text-gray-800">“{truncate(item.message, 140)}”</div>
                      <div className="flex flex-wrap items-center gap-2">
                        <UrgencyBadge urgency={item.urgency} suffix=" urgency" />
                        <CategoryBadge category={item.category} />
                        <ConfidenceBadge confidence={item.confidence} />
                        {needsReview(item) && <ReviewBadge />}
                        {item.corrected && <CorrectedBadge original={item.original} />}
                        {item.usedFallback && <FallbackBadge />}
                      </div>
                    </button>
                    <div className="flex shrink-0 flex-col items-end gap-2 sm:flex-row sm:items-center">
                      <select
                        aria-label="Status"
                        value={item.status}
                        onChange={e => setStatus(item, e.target.value)}
                        className={`rounded-md border px-2 py-1 text-sm font-semibold ${STATUS_SELECT_STYLES[item.status]}`}
                      >
                        {STATUSES.map(status => <option key={status} value={status}>{status}</option>)}
                      </select>
                      <button
                        type="button"
                        onClick={() => remove(item)}
                        aria-label="Delete message"
                        title="Delete"
                        className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-600"
                      >
                        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                          <path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                      <span className="hidden text-gray-400 sm:inline" aria-hidden="true">{expanded ? '▲' : '▼'}</span>
                    </div>
                  </div>

                  {expanded && (
                    <div className="border-t border-gray-200 bg-gray-50 p-4">
                      <AnalysisDetails
                        key={item.id}
                        entry={item}
                        categoryNames={categoryNames}
                        showMessage
                        onCorrect={changes => correct(item, changes)}
                        onReplyChange={reply => saveReply(item, reply)}
                      />
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}

export default HistoryPage
