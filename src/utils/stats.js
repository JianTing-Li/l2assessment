const DAY_MS = 24 * 60 * 60 * 1000

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
