import { useMemo, useState } from 'react'
import UrgencyChart from '../components/UrgencyChart'
import { loadHistory } from '../utils/storage'
import { averagePerDay, dailyUrgencyCounts, filterByRange, RANGES } from '../utils/stats'
import { agreementStats, needsReview } from '../utils/corrections'
import { toCsv } from '../utils/extract'

const CSV_COLUMNS = [
  ['Timestamp', 'timestamp'],
  ['Status', 'status'],
  ['Category', 'category'],
  ['Urgency', 'urgency'],
  ['Confidence', 'confidence'],
  ['Route to', 'routeTo'],
  ['Sentiment', 'sentiment'],
  ['Product area', 'productArea'],
  ['Language', 'language'],
  ['References', 'extractedIds'],
  ['Corrected', item => (item.corrected ? 'yes' : '')],
  ['AI category', item => item.original?.category ?? item.category],
  ['AI urgency', item => item.original?.urgency ?? item.urgency],
  ['Keyword fallback', item => (item.usedFallback ? 'yes' : '')],
  ['Message', 'message'],
  ['Recommended action', 'recommendedAction'],
  ['Suggested reply', 'suggestedReply'],
]

function downloadCsv(rows) {
  const csv = toCsv(rows, CSV_COLUMNS)
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
  const link = document.createElement('a')
  link.href = url
  link.download = `triage-${new Date().toISOString().slice(0, 10)}.csv`
  link.click()
  URL.revokeObjectURL(url)
}

function Card({ title, children, className = '' }) {
  return (
    <section className={`rounded-lg bg-white p-6 shadow ${className}`}>
      {title && <h2 className="mb-4 text-lg font-bold text-gray-900">{title}</h2>}
      {children}
    </section>
  )
}

function Stat({ label, value, hint }) {
  return (
    <div className="rounded-lg bg-white p-5 shadow">
      <div className="mb-1 text-sm text-gray-600">{label}</div>
      <div className="text-3xl font-bold tabular-nums text-gray-900">{value}</div>
      {hint && <div className="mt-1 text-xs text-gray-500">{hint}</div>}
    </div>
  )
}

function Empty() {
  return <div className="py-8 text-center text-gray-500">No data in this range</div>
}

function DashboardPage() {
  const [history] = useState(loadHistory)
  const [range, setRange] = useState('7')

  const inRange = useMemo(() => filterByRange(history, range), [history, range])
  const daily = useMemo(() => dailyUrgencyCounts(history, range), [history, range])
  const agreement = useMemo(() => agreementStats(inRange), [inRange])

  const highCount = inRange.filter(h => h.urgency === 'High').length
  const highPercent = inRange.length ? Math.round((highCount / inRange.length) * 100) : 0
  const open = history.filter(h => h.status !== 'Resolved')
  const openReview = open.filter(needsReview).length
  const fallbackCount = inRange.filter(h => h.usedFallback).length
  const days = RANGES[range].days
  const avgPerDay = days ? Math.round((inRange.length / days) * 10) / 10 : averagePerDay(history)

  const categoryData = useMemo(() => {
    const counts = {}
    for (const item of inRange) counts[item.category] = (counts[item.category] || 0) + 1
    return Object.entries(counts).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count)
  }, [inRange])

  const insights = [
    highPercent > 30 && `High-urgency messages are ${highPercent}% of volume in this range. Consider more support cover.`,
    openReview > 0 && `${openReview} open message${openReview === 1 ? '' : 's'} need${openReview === 1 ? 's' : ''} a person to check the category or urgency.`,
    agreement.keptPercent !== null && agreement.keptPercent < 80 && agreement.correctionsByCategory[0] &&
      `Agents changed ${100 - agreement.keptPercent}% of reviewed AI results, most often for ${agreement.correctionsByCategory[0].category}. Check that category's description in Settings.`,
    fallbackCount > 0 && `${fallbackCount} result${fallbackCount === 1 ? '' : 's'} in this range came from keyword rules because the AI was unavailable.`,
    history.length === 0 && 'Analyze some messages to see insights here.',
  ].filter(Boolean)

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="mx-auto max-w-7xl px-4">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
            <p className="text-gray-600">Message volume, urgency and AI accuracy</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div role="group" aria-label="Date range" className="inline-flex rounded-lg bg-gray-200 p-1">
              {Object.entries(RANGES).map(([id, r]) => (
                <button
                  key={id}
                  type="button"
                  aria-pressed={range === id}
                  onClick={() => setRange(id)}
                  className={`rounded-md px-3 py-1.5 text-sm font-semibold ${range === id ? 'bg-white text-blue-700 shadow' : 'text-gray-600 hover:text-gray-900'}`}
                >
                  {r.label}
                </button>
              ))}
            </div>
            <button
              type="button"
              disabled={inRange.length === 0}
              onClick={() => downloadCsv(inRange)}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-300"
            >
              Export CSV
            </button>
          </div>
        </div>

        <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-6">
          <Stat label="Messages" value={inRange.length} hint={RANGES[range].label} />
          <Stat label="High urgency" value={`${highPercent}%`} hint={`${highCount} messages`} />
          <Stat label="Avg per day" value={avgPerDay} />
          <Stat label="Open now" value={open.length} hint="All time" />
          <Stat label="Open, needs review" value={openReview} />
          <Stat
            label="AI kept as-is"
            value={agreement.keptPercent === null ? '—' : `${agreement.keptPercent}%`}
            hint={agreement.reviewed ? `of ${agreement.reviewed} reviewed` : 'Nothing reviewed yet'}
          />
        </div>

        <Card title="Messages per day by urgency" className="mb-6">
          {inRange.length === 0 ? <Empty /> : <UrgencyChart rows={daily} />}
          {range === 'all' && daily.length === 90 && <p className="mt-2 text-xs text-gray-500">Showing the last 90 days.</p>}
        </Card>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Card title="Category distribution">
            {categoryData.length === 0 ? <Empty /> : (
              <div className="space-y-3">
                {categoryData.map(cat => {
                  const percentage = (cat.count / inRange.length) * 100
                  return (
                    <div key={cat.name}>
                      <div className="mb-1 flex justify-between text-sm">
                        <span className="text-gray-700">{cat.name}</span>
                        <span className="tabular-nums text-gray-600">{cat.count} ({percentage.toFixed(0)}%)</span>
                      </div>
                      <div className="h-2 w-full rounded-full bg-gray-100">
                        <div className="h-2 rounded-full bg-blue-600" style={{ width: `${percentage}%` }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </Card>

          <Card title="Agent corrections">
            {agreement.reviewed === 0 ? (
              <p className="py-4 text-sm text-gray-500">
                Change a message's status or correct its category or urgency in the queue, and the AI's accuracy will show here.
              </p>
            ) : (
              <>
                <p className="mb-4 text-sm text-gray-700">
                  Agents reviewed <strong>{agreement.reviewed}</strong> AI results and changed <strong>{agreement.corrected}</strong>.
                  Recent corrections are sent to the AI as examples.
                </p>
                {agreement.correctionsByCategory.length === 0 ? (
                  <p className="text-sm text-gray-500">No corrections yet.</p>
                ) : (
                  <table className="w-full text-left text-sm">
                    <thead className="text-gray-600"><tr><th className="py-1">AI's category</th><th className="py-1 text-right">Corrections</th></tr></thead>
                    <tbody className="divide-y divide-gray-100">
                      {agreement.correctionsByCategory.map(row => (
                        <tr key={row.category}><td className="py-1.5 text-gray-800">{row.category}</td><td className="py-1.5 text-right tabular-nums">{row.count}</td></tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </>
            )}
          </Card>
        </div>

        <div className="mt-6 rounded-lg border border-blue-200 bg-blue-50 p-6">
          <h2 className="mb-2 text-lg font-bold text-blue-900">Insights</h2>
          {insights.length === 0 ? (
            <p className="text-sm text-blue-800">Nothing needs attention.</p>
          ) : (
            <ul className="list-disc space-y-1 pl-5 text-sm text-blue-900">
              {insights.map(text => <li key={text}>{text}</li>)}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}

export default DashboardPage
