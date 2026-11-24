/**
 * Recommended actions and routing. Each category has an action per urgency
 * (falling back to "default") and the team it is routed to.
 */
import { DEFAULT_CATEGORIES, UNKNOWN_CATEGORY } from '../../shared/defaults.js'

const withUnknown = categories => [...categories, UNKNOWN_CATEGORY]

function findCategory(categories, name) {
  return withUnknown(categories).find(c => c.name === name)
}

/** Build an action lookup for a category list (defaults to the built-in one). */
export function makeActionFor(categories = DEFAULT_CATEGORIES) {
  return (category, urgency) => {
    const actions = findCategory(categories, category)?.actions
    if (!actions) return 'No recommendation available.'
    return actions[urgency] || actions.default || 'No recommendation available.'
  }
}

/** Team a category is routed to. */
export function makeRouteFor(categories = DEFAULT_CATEGORIES) {
  return category => findCategory(categories, category)?.team || UNKNOWN_CATEGORY.team
}

/** Recommended next step using the built-in categories. */
export const getRecommendedAction = makeActionFor()
