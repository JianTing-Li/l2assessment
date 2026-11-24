import { describe, it, expect, beforeEach } from 'vitest'
import { loadHistory, saveHistory, addToHistory, updateHistoryEntry, deleteHistoryEntry, sortByNewest, MAX_HISTORY } from './storage'
import { loadSettings, saveSettings, triageContext } from './settings'
import { applyCorrection, agreementStats, correctionExamples, needsReview } from './corrections'
import { averagePerDay, daysCovered, filterByRange, dailyUrgencyCounts } from './stats'

function memoryStorage() {
  const data = new Map()
  return {
    getItem: key => (data.has(key) ? data.get(key) : null),
    setItem: (key, value) => data.set(key, String(value)),
    removeItem: key => data.delete(key),
    clear: () => data.clear(),
  }
}

beforeEach(() => {
  globalThis.localStorage = memoryStorage()
})

const entry = (overrides = {}) => ({
  id: Math.random().toString(36).slice(2),
  message: 'Server down',
  category: 'Technical Problem',
  urgency: 'High',
  urgencyReasoning: 'Outage.',
  recommendedAction: 'Page on-call.',
  status: 'Open',
  timestamp: new Date().toISOString(),
  ...overrides,
})

describe('storage', () => {
  it('survives corrupted data', () => {
    localStorage.setItem('triageHistory', '{not json')
    expect(loadHistory()).toEqual([])
    localStorage.setItem('triageHistory', '{"a":1}')
    expect(loadHistory()).toEqual([])
  })

  it('gives old entries an id and a status', () => {
    localStorage.setItem('triageHistory', JSON.stringify([{ message: 'old', timestamp: '2026-01-01T00:00:00Z', category: 'General Inquiry', urgency: 'Low' }]))
    const [item] = loadHistory()
    expect(item.id).toBeTruthy()
    expect(item.status).toBe('Open')
  })

  it('adds, updates, deletes and caps history', () => {
    const a = entry()
    addToHistory([a])
    updateHistoryEntry(a.id, { status: 'Resolved' })
    expect(loadHistory()[0].status).toBe('Resolved')
    deleteHistoryEntry(a.id)
    expect(loadHistory()).toEqual([])

    saveHistory(Array.from({ length: MAX_HISTORY + 20 }, (_, i) => entry({ id: String(i) })))
    expect(loadHistory()).toHaveLength(MAX_HISTORY)
    expect(loadHistory()[0].id).toBe('20')
  })

  it('sorts newest first', () => {
    const sorted = sortByNewest([entry({ id: 'old', timestamp: '2026-01-01T00:00:00Z' }), entry({ id: 'new', timestamp: '2026-02-01T00:00:00Z' })])
    expect(sorted.map(e => e.id)).toEqual(['new', 'old'])
  })
})

describe('settings', () => {
  it('keeps built-in categories and adds valid custom ones', () => {
    saveSettings({
      categories: [
        { name: 'Billing Issue', description: 'money', team: 'Finance', actions: { default: 'Check it' } },
        { name: 'Account Access', description: 'logins', team: 'Identity', actions: { default: 'Reset' } },
        { name: 'Unknown', actions: { default: 'x' } },
        { name: '' },
      ],
      alertsEnabled: false,
    })
    const settings = loadSettings()
    expect(settings.categories.map(c => c.name)).toEqual([
      'Billing Issue', 'Technical Problem', 'Feature Request', 'General Inquiry', 'Positive Feedback', 'Account Access',
    ])
    expect(settings.categories[0].team).toBe('Finance')
    expect(settings.alertsEnabled).toBe(false)

    const { actionFor, routeFor } = triageContext(settings)
    expect(routeFor('Account Access')).toBe('Identity')
    expect(actionFor('Technical Problem', 'High')).toMatch(/on-call/)
    expect(actionFor('Unknown', 'Medium')).toBe('Review manually.')
  })

  it('falls back to defaults on corrupted settings', () => {
    localStorage.setItem('triageSettings', 'oops')
    expect(loadSettings().categories).toHaveLength(5)
  })
})

describe('corrections', () => {
  const context = triageContext(loadSettingsDefaults())
  function loadSettingsDefaults() {
    globalThis.localStorage = memoryStorage()
    return loadSettings()
  }

  it('records the AI answer, updates action and routing, and can be undone', () => {
    const original = entry()
    const corrected = applyCorrection(original, { category: 'Billing Issue', urgency: 'Medium' }, context)
    expect(corrected).toMatchObject({ corrected: true, category: 'Billing Issue', routeTo: 'Billing team' })
    expect(corrected.original).toMatchObject({ category: 'Technical Problem', urgency: 'High' })
    expect(corrected.urgencyReasoning).toMatch(/by an agent/)

    const undone = applyCorrection(corrected, { category: 'Technical Problem', urgency: 'High' }, context)
    expect(undone.corrected).toBe(false)
    expect(undone.recommendedAction).toBe('Page on-call.')
    expect(undone.urgencyReasoning).toBe('Outage.')
  })

  it('measures agreement only over reviewed AI results', () => {
    const history = [
      entry({ status: 'Resolved' }),
      entry({ status: 'Open' }), // not reviewed
      { ...entry({ corrected: true, original: { category: 'General Inquiry' } }) },
      entry({ status: 'Resolved', usedFallback: true }), // not AI
    ]
    const stats = agreementStats(history)
    expect(stats).toMatchObject({ reviewed: 2, corrected: 1, keptPercent: 50 })
    expect(stats.correctionsByCategory).toEqual([{ category: 'General Inquiry', count: 1 }])
    expect(correctionExamples(history)).toHaveLength(1)
  })

  it('flags low confidence and unknown messages for review', () => {
    expect(needsReview({ confidence: 'Low', category: 'Billing Issue' })).toBe(true)
    expect(needsReview({ confidence: 'High', category: 'Unknown' })).toBe(true)
    expect(needsReview({ confidence: 'High', category: 'Billing Issue' })).toBe(false)
  })
})

describe('stats', () => {
  const now = new Date('2026-11-23T15:00:00')
  const at = (days, hour = 10) => {
    const d = new Date(now)
    d.setDate(d.getDate() - days)
    d.setHours(hour)
    return { timestamp: d.toISOString(), urgency: 'High' }
  }

  it('averages over the days actually covered', () => {
    expect(daysCovered([], now)).toBe(0)
    expect(averagePerDay([], now)).toBe(0)
    expect(averagePerDay([at(0), at(0)], now)).toBe(2)
    expect(averagePerDay([at(2), at(0), at(0)], now)).toBe(1)
  })

  it('filters by range and builds one row per day', () => {
    const history = [at(0), at(6), at(7), at(40)]
    expect(filterByRange(history, '7', now)).toHaveLength(2)
    expect(filterByRange(history, 'all', now)).toHaveLength(4)
    const rows = dailyUrgencyCounts(history, '7', now)
    expect(rows).toHaveLength(7)
    expect(rows[6].High).toBe(1)
    expect(rows[0].High).toBe(1)
    expect(dailyUrgencyCounts(history, 'all', now)).toHaveLength(41)
  })
})
