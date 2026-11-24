import { useState } from 'react'

// Validated with the dataviz palette checker. Amber sits in the colour-blind
// floor band, so identity is also carried by fixed stack order, the legend,
// tooltips and the table view.
const SERIES = [
  { key: 'High', color: '#dc2626' },
  { key: 'Medium', color: '#f59e0b' },
  { key: 'Low', color: '#16a34a' },
]
const PLOT_HEIGHT = 180

const shortDate = date => date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })

/** Stacked bars of messages per day, High at the baseline. */
export default function UrgencyChart({ rows }) {
  const [hovered, setHovered] = useState(null)
  const [showTable, setShowTable] = useState(false)
  const max = Math.max(1, ...rows.map(r => r.total))
  const labelEvery = rows.length <= 10 ? 1 : Math.ceil(rows.length / 7)
  const active = hovered === null ? null : rows[hovered]

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <ul className="flex flex-wrap gap-4 text-sm text-gray-700" aria-label="Legend">
          {SERIES.map(s => (
            <li key={s.key} className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-sm" style={{ backgroundColor: s.color }} aria-hidden="true" />
              {s.key}
            </li>
          ))}
        </ul>
        <button type="button" onClick={() => setShowTable(t => !t)} className="text-sm font-semibold text-blue-700 hover:text-blue-900">
          {showTable ? 'Show chart' : 'Show table'}
        </button>
      </div>

      {showTable ? (
        <div className="max-h-72 overflow-auto">
          <table className="w-full text-left text-sm">
            <thead className="sticky top-0 bg-white text-gray-600">
              <tr><th className="py-1 pr-4">Day</th>{SERIES.map(s => <th key={s.key} className="py-1 pr-4 text-right">{s.key}</th>)}<th className="py-1 text-right">Total</th></tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-gray-800">
              {[...rows].reverse().map(row => (
                <tr key={row.key}>
                  <td className="py-1 pr-4">{shortDate(row.date)}</td>
                  {SERIES.map(s => <td key={s.key} className="py-1 pr-4 text-right tabular-nums">{row[s.key]}</td>)}
                  <td className="py-1 text-right font-semibold tabular-nums">{row.total}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="relative">
          <div className="flex text-xs text-gray-500">
            <div className="flex w-8 shrink-0 flex-col justify-between pr-2 text-right tabular-nums" style={{ height: PLOT_HEIGHT }}>
              <span>{max}</span>
              <span>0</span>
            </div>
            <div className="relative flex-1">
              <div className="absolute inset-x-0 top-0 border-t border-dashed border-gray-200" />
              <div
                className="flex items-end border-b border-gray-300"
                style={{ height: PLOT_HEIGHT, gap: rows.length > 40 ? 1 : 4 }}
                onMouseLeave={() => setHovered(null)}
              >
                {rows.map((row, i) => (
                  <div
                    key={row.key}
                    tabIndex={0}
                    role="img"
                    aria-label={`${shortDate(row.date)}: ${row.total} messages, ${row.High} high, ${row.Medium} medium, ${row.Low} low`}
                    onMouseEnter={() => setHovered(i)}
                    onFocus={() => setHovered(i)}
                    onBlur={() => setHovered(null)}
                    className={`flex h-full min-w-0 flex-1 cursor-default flex-col-reverse rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${hovered === i ? 'bg-gray-100' : ''}`}
                  >
                    {SERIES.map((s, si) => {
                      const value = row[s.key]
                      if (!value) return null
                      const isTop = SERIES.slice(si + 1).every(other => !row[other.key])
                      return (
                        <div
                          key={s.key}
                          style={{
                            height: (value / max) * PLOT_HEIGHT,
                            backgroundColor: s.color,
                            marginTop: isTop ? 0 : 2,
                            borderRadius: isTop ? '4px 4px 0 0' : 0,
                          }}
                        />
                      )
                    })}
                  </div>
                ))}
              </div>
              <div className="mt-1 flex" style={{ gap: rows.length > 40 ? 1 : 4 }}>
                {rows.map((row, i) => (
                  <div key={row.key} className="min-w-0 flex-1 overflow-visible whitespace-nowrap text-center">
                    {(rows.length - 1 - i) % labelEvery === 0 ? shortDate(row.date) : ''}
                  </div>
                ))}
              </div>

              {active && (
                <div
                  className="pointer-events-none absolute top-0 z-10 w-40 -translate-x-1/2 rounded-md border border-gray-200 bg-white p-2 text-xs text-gray-700 shadow-lg"
                  style={{ left: `${((hovered + 0.5) / rows.length) * 100}%` }}
                >
                  <div className="mb-1 font-semibold text-gray-900">{shortDate(active.date)} · {active.total} total</div>
                  {SERIES.map(s => (
                    <div key={s.key} className="flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <span className="h-2 w-2 rounded-sm" style={{ backgroundColor: s.color }} aria-hidden="true" />
                        {s.key}
                      </span>
                      <span className="tabular-nums">{active[s.key]}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
