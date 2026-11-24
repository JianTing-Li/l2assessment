import { useState } from 'react'
import Flash from '../components/Flash'
import { useFlash } from '../hooks/useFlash'
import { loadSettings, saveSettings, resetSettings, isBuiltIn } from '../utils/settings'

const MAX_CATEGORIES = 12
const inputClass = 'w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500'

function Field({ label, hint, children }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-600">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-gray-500">{hint}</span>}
    </label>
  )
}

/** Problems that would stop the settings from saving. */
function validate(categories) {
  const names = categories.map(c => c.name.trim())
  if (names.some(name => !name)) return 'Every category needs a name.'
  if (names.some(name => name.toLowerCase() === 'unknown')) return '“Unknown” is reserved for messages the app cannot classify.'
  const dupe = names.find((name, i) => names.findIndex(n => n.toLowerCase() === name.toLowerCase()) !== i)
  if (dupe) return `There are two categories named “${dupe}”.`
  if (categories.some(c => !c.actions.default.trim())) return 'Every category needs a default action.'
  return null
}

function SettingsPage() {
  const [settings, setSettings] = useState(loadSettings)
  const [dirty, setDirty] = useState(false)
  const [flash, showFlash] = useFlash(3000)

  const update = next => {
    setSettings(next)
    setDirty(true)
  }

  const updateCategory = (index, changes) => {
    update({
      ...settings,
      categories: settings.categories.map((c, i) => (i === index ? { ...c, ...changes, actions: { ...c.actions, ...changes.actions } } : c)),
    })
  }

  const addCategory = () => {
    update({
      ...settings,
      categories: [...settings.categories, { name: '', description: '', team: 'Support team', actions: { default: '' } }],
    })
  }

  const removeCategory = index => {
    update({ ...settings, categories: settings.categories.filter((_, i) => i !== index) })
  }

  const save = () => {
    const categories = settings.categories.map(c => ({
      ...c,
      name: c.name.trim(),
      actions: { ...(c.actions.High?.trim() ? { High: c.actions.High.trim() } : {}), default: c.actions.default.trim() },
    }))
    const problem = validate(categories)
    if (problem) {
      showFlash(problem, 'error')
      return
    }
    const next = { ...settings, categories }
    if (!saveSettings(next)) {
      showFlash('Could not save. Your browser may be blocking storage.', 'error')
      return
    }
    setSettings(next)
    setDirty(false)
    showFlash('Settings saved. New analyses will use them.')
  }

  const reset = () => {
    if (!window.confirm('Reset all categories, teams and actions to the defaults?')) return
    setSettings(resetSettings())
    setDirty(false)
    showFlash('Settings reset to defaults.')
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="mx-auto max-w-4xl px-4">
        <div className="mb-6 rounded-lg bg-white p-6 shadow-md">
          <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
          <p className="text-gray-600">
            Categories, the team each one routes to, and the recommended actions. Descriptions are sent to the AI, so a clear
            description is the best way to fix a category it keeps getting wrong. Settings are stored in this browser.
          </p>
        </div>

        <section className="mb-6 rounded-lg bg-white p-6 shadow-md">
          <h2 className="mb-3 text-lg font-bold text-gray-900">Alerts</h2>
          <label className="flex items-start gap-3">
            <input
              type="checkbox"
              className="mt-1 rounded border-gray-300"
              checked={settings.alertsEnabled}
              onChange={e => update({ ...settings, alertsEnabled: e.target.checked })}
            />
            <span className="text-sm text-gray-700">
              Post High-urgency messages to Slack.
              <span className="block text-gray-500">
                Needs <code className="rounded bg-gray-100 px-1">SLACK_WEBHOOK_URL</code> set on the server (in <code className="rounded bg-gray-100 px-1">.env.local</code> or your Vercel project). Without it, nothing is sent.
              </span>
            </span>
          </label>
        </section>

        <section className="mb-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-gray-900">Categories</h2>
            <button
              type="button"
              onClick={addCategory}
              disabled={settings.categories.length >= MAX_CATEGORIES}
              className="rounded-lg border border-blue-300 px-4 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-50 disabled:opacity-50"
            >
              + Add category
            </button>
          </div>

          {settings.categories.map((category, index) => {
            const builtIn = isBuiltIn(category.name) && index < 5
            return (
              <div key={builtIn ? category.name : `custom-${index}`} className="rounded-lg bg-white p-5 shadow">
                <div className="mb-4 flex items-start justify-between gap-3">
                  {builtIn ? (
                    <h3 className="text-base font-bold text-gray-900">{category.name}</h3>
                  ) : (
                    <div className="flex-1">
                      <Field label="Name">
                        <input className={inputClass} value={category.name} maxLength={40} onChange={e => updateCategory(index, { name: e.target.value })} placeholder="e.g. Account Access" />
                      </Field>
                    </div>
                  )}
                  {builtIn ? (
                    <span className="text-xs text-gray-500">Built-in</span>
                  ) : (
                    <button type="button" onClick={() => removeCategory(index)} className="text-sm font-semibold text-red-700 hover:text-red-900">
                      Remove
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                  <div className="md:col-span-2">
                    <Field label="Description for the AI">
                      <textarea className={`${inputClass} h-20`} maxLength={300} value={category.description} onChange={e => updateCategory(index, { description: e.target.value })} />
                    </Field>
                  </div>
                  <Field label="Route to">
                    <input className={inputClass} maxLength={60} value={category.team} onChange={e => updateCategory(index, { team: e.target.value })} />
                  </Field>
                  <div className="md:col-span-3 grid grid-cols-1 gap-4 md:grid-cols-2">
                    <Field label="Action when High urgency" hint="Leave empty to use the default action.">
                      <textarea className={`${inputClass} h-20`} value={category.actions.High || ''} onChange={e => updateCategory(index, { actions: { High: e.target.value } })} />
                    </Field>
                    <Field label="Default action">
                      <textarea className={`${inputClass} h-20`} value={category.actions.default} onChange={e => updateCategory(index, { actions: { default: e.target.value } })} />
                    </Field>
                  </div>
                </div>
              </div>
            )
          })}
        </section>

        <div className="sticky bottom-0 -mx-4 flex flex-wrap items-center gap-3 border-t border-gray-200 bg-gray-50/95 px-4 py-4 backdrop-blur">
          <button type="button" onClick={save} disabled={!dirty} className="rounded-lg bg-blue-600 px-6 py-2 font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-300">
            Save changes
          </button>
          <button type="button" onClick={reset} className="rounded-lg border border-gray-300 px-4 py-2 font-semibold text-gray-700 hover:bg-white">
            Reset to defaults
          </button>
          <Flash flash={flash} />
        </div>
      </div>
    </div>
  )
}

export default SettingsPage
