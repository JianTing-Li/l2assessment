const DAY_MS = 24 * 60 * 60 * 1000

/** Midnight `days` calendar days before `date` (safe across daylight-saving changes). */
function daysBefore(date, days) {
  const d = startOfDay(date)
  d.setDate(d.getDate() - days)
  return d
}

function startOfDay(date) {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  return d
}

/**
 * Number of calendar days from the first analysis through today, inclusive.
 * Returns 0 when there is no history.
 */
export function daysCovered(history, now = new Date()) {
  const times = history.map(item => new Date(item.timestamp).getTime()).filter(t => !Number.isNaN(t))
  if (times.length === 0) return 0
  const first = startOfDay(Math.min(...times))
  return Math.round((startOfDay(now) - first) / DAY_MS) + 1
}

/** Average analyses per day over the days actually covered, to one decimal. */
export function averagePerDay(history, now = new Date()) {
  const days = daysCovered(history, now)
  if (days === 0) return 0
  return Math.round((history.length / days) * 10) / 10
}

export const RANGES = {
  7: { label: 'Last 7 days', days: 7 },
  30: { label: 'Last 30 days', days: 30 },
  all: { label: 'All time', days: null },
}

/** Entries inside a range ('7', '30' or 'all'), counting today as day one. */
export function filterByRange(history, range, now = new Date()) {
  const days = RANGES[range]?.days
  if (!days) return history
  const from = daysBefore(now, days - 1).getTime()
  return history.filter(item => new Date(item.timestamp).getTime() >= from)
}

const MAX_CHART_DAYS = 90

/**
 * One row per calendar day (oldest first) with counts per urgency.
 * 'all' covers the days since the first entry, capped at 90.
 */
export function dailyUrgencyCounts(history, range, now = new Date()) {
  const days = Math.min(RANGES[range]?.days ?? Math.max(daysCovered(history, now), 1), MAX_CHART_DAYS)
  const rows = Array.from({ length: days }, (_, i) => {
    const date = daysBefore(now, days - 1 - i)
    return { date, key: date.toDateString(), High: 0, Medium: 0, Low: 0, total: 0 }
  })
  const byKey = new Map(rows.map(row => [row.key, row]))
  for (const item of history) {
    const row = byKey.get(new Date(item.timestamp).toDateString())
    if (row && row[item.urgency] !== undefined) {
      row[item.urgency]++
      row.total++
    }
  }
  return rows
}
