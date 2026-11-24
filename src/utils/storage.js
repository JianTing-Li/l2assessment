/**
 * localStorage helpers for triage history. Every read is wrapped so a corrupted
 * or hand-edited value never crashes a page.
 */

const HISTORY_KEY = 'triageHistory'
export const MAX_HISTORY = 500

function readJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return fallback
    const value = JSON.parse(raw)
    return value ?? fallback
  } catch {
    return fallback
  }
}

function writeJson(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
    return true
  } catch {
    return false
  }
}

export function makeId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

/** Fill in fields that older saved entries don't have. */
function normalizeEntry(entry, index) {
  return {
    ...entry,
    id: entry.id || `legacy-${entry.timestamp || ''}-${index}`,
    status: entry.status || 'Open',
  }
}

/** All saved analyses, oldest first. Invalid entries are dropped. */
export function loadHistory() {
  const history = readJson(HISTORY_KEY, [])
  if (!Array.isArray(history)) return []
  return history
    .filter(item => item && typeof item.message === 'string' && item.timestamp)
    .map(normalizeEntry)
}

export function saveHistory(history) {
  return writeJson(HISTORY_KEY, history.slice(-MAX_HISTORY))
}

export function addToHistory(entries) {
  const history = loadHistory()
  history.push(...entries)
  saveHistory(history)
  return loadHistory()
}

export function updateHistoryEntry(id, changes) {
  const history = loadHistory().map(item => (item.id === id ? { ...item, ...changes } : item))
  saveHistory(history)
  return history
}

export function deleteHistoryEntry(id) {
  const history = loadHistory().filter(item => item.id !== id)
  saveHistory(history)
  return history
}

export function clearHistory() {
  saveHistory([])
}

/** Newest first. */
export function sortByNewest(history) {
  return [...history].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
}
