import { DEFAULT_CATEGORIES, BUILT_IN_NAMES } from '../../shared/defaults.js'
import { makeActionFor, makeRouteFor } from './templates'

const SETTINGS_KEY = 'triageSettings'

export const DEFAULT_SETTINGS = {
  categories: DEFAULT_CATEGORIES,
  alertsEnabled: true,
}

const clone = value => JSON.parse(JSON.stringify(value))

function sanitizeCategory(category) {
  if (!category || typeof category.name !== 'string' || !category.name.trim()) return null
  const actions = category.actions && typeof category.actions === 'object' ? category.actions : {}
  return {
    name: category.name.trim().slice(0, 40),
    description: String(category.description ?? '').slice(0, 300),
    team: String(category.team ?? '').slice(0, 60),
    actions: {
      ...(actions.High ? { High: String(actions.High) } : {}),
      default: String(actions.default || 'Review manually.'),
    },
  }
}

/**
 * Saved settings merged over the defaults. Built-in categories always exist
 * (their names are fixed so history and keyword rules stay valid).
 */
export function loadSettings() {
  let saved = null
  try {
    saved = JSON.parse(localStorage.getItem(SETTINGS_KEY) || 'null')
  } catch {
    saved = null
  }
  const defaults = clone(DEFAULT_SETTINGS)
  if (!saved || typeof saved !== 'object') return defaults

  const savedCategories = Array.isArray(saved.categories) ? saved.categories.map(sanitizeCategory).filter(Boolean) : []
  const byName = new Map(savedCategories.map(c => [c.name, c]))
  const builtIns = defaults.categories.map(c => byName.get(c.name) ?? c)
  const seen = new Set(BUILT_IN_NAMES)
  const custom = savedCategories.filter(c => {
    if (seen.has(c.name) || c.name === 'Unknown') return false
    seen.add(c.name)
    return true
  })

  return {
    categories: [...builtIns, ...custom],
    alertsEnabled: typeof saved.alertsEnabled === 'boolean' ? saved.alertsEnabled : defaults.alertsEnabled,
  }
}

export function saveSettings(settings) {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings))
    return true
  } catch {
    return false
  }
}

export function resetSettings() {
  try {
    localStorage.removeItem(SETTINGS_KEY)
  } catch {
    // ignore
  }
  return clone(DEFAULT_SETTINGS)
}

export function isBuiltIn(name) {
  return BUILT_IN_NAMES.includes(name)
}

/** Everything the triage call needs from settings. */
export function triageContext(settings) {
  return {
    categories: settings.categories.map(({ name, description }) => ({ name, description })),
    actionFor: makeActionFor(settings.categories),
    routeFor: makeRouteFor(settings.categories),
  }
}
