import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { loadHistory, sortByNewest } from '../utils/storage'
import { CategoryBadge, UrgencyBadge, StatusBadge, FallbackBadge } from '../components/Badges'

const EXAMPLES = [
  "Our payment failed and we can't access our account",
  'The dashboard is loading very slowly',
  'Can you add a dark mode feature?',
  'Database connection lost. Order #48213 is stuck at checkout.',
  'Can I upgrade my subscription to the pro plan?',
]

const truncate = (text, length) => (text.length > length ? `${text.slice(0, length).trimEnd()}…` : text)

function HomePage() {
  const navigate = useNavigate()
  const [history] = useState(loadHistory)
  const today = new Date().toDateString()
  const open = history.filter(item => item.status !== 'Resolved')
  const stats = [
    { label: 'Analyzed today', value: history.filter(item => new Date(item.timestamp).toDateString() === today).length, color: 'text-green-600' },
    { label: 'Open in queue', value: open.length, color: 'text-blue-600' },
    { label: 'Open and high urgency', value: open.filter(item => item.urgency === 'High').length, color: 'text-red-600' },
    { label: 'Total analyzed', value: history.length, color: 'text-gray-700' },
  ]
  const recentActivity = sortByNewest(history).slice(0, 3)

  const tryExample = () => {
    const example = EXAMPLES[Math.floor(Math.random() * EXAMPLES.length)]
    navigate('/analyze', { state: { example } })
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="mx-auto max-w-6xl px-4">
        <div className="mb-6 rounded-lg bg-white p-6 shadow-md sm:p-8">
          <h1 className="mb-3 text-2xl font-bold text-gray-900 sm:text-3xl">Triage customer messages in seconds</h1>
          <p className="text-gray-700">
            Paste a customer message, or a whole batch, and get its category, urgency, the team to route it to,
            a recommended next step and a draft reply. Work through them in the queue and correct anything the AI got wrong.
          </p>
        </div>

        <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
          {stats.map(stat => (
            <div key={stat.label} className="rounded-lg bg-white p-5 shadow">
              <div className={`text-3xl font-bold ${stat.color}`}>{stat.value}</div>
              <div className="text-sm text-gray-600">{stat.label}</div>
            </div>
          ))}
        </div>

        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Link to="/analyze" className="rounded-lg bg-blue-600 p-6 text-white transition hover:bg-blue-700">
            <div className="mb-2 text-2xl" aria-hidden="true">📝</div>
            <div className="mb-1 font-semibold">Analyze messages</div>
            <div className="text-sm text-blue-100">One message, a pasted batch or a CSV</div>
          </Link>

          <Link to="/history" className="rounded-lg bg-purple-600 p-6 text-white transition hover:bg-purple-700">
            <div className="mb-2 text-2xl" aria-hidden="true">📥</div>
            <div className="mb-1 font-semibold">Work the queue</div>
            <div className="text-sm text-purple-100">{open.length} open, most urgent first</div>
          </Link>

          <button type="button" onClick={tryExample} className="rounded-lg bg-orange-600 p-6 text-left text-white transition hover:bg-orange-700">
            <div className="mb-2 text-2xl" aria-hidden="true">🎯</div>
            <div className="mb-1 font-semibold">Try an example</div>
            <div className="text-sm text-orange-100">Fill in a sample message</div>
          </button>
        </div>

        {recentActivity.length > 0 ? (
          <div className="rounded-lg bg-white p-6 shadow-md">
            <h2 className="mb-4 text-xl font-bold text-gray-900">Recent activity</h2>
            <div className="space-y-3">
              {recentActivity.map(item => (
                <div key={item.id} className="border-l-4 border-blue-500 py-2 pl-4">
                  <div className="text-sm text-gray-500">{new Date(item.timestamp).toLocaleString()}</div>
                  <div className="truncate text-gray-700">“{truncate(item.message, 80)}”</div>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <CategoryBadge category={item.category} />
                    <UrgencyBadge urgency={item.urgency} />
                    <StatusBadge status={item.status} />
                    {item.usedFallback && <FallbackBadge />}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="rounded-lg bg-white p-8 text-center shadow-md">
            <div className="mb-3 text-4xl" aria-hidden="true">📭</div>
            <div className="mb-4 text-gray-600">No messages analyzed yet</div>
            <Link to="/analyze" className="inline-block rounded-lg bg-blue-600 px-6 py-2 text-white hover:bg-blue-700">
              Analyze your first message
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}

export default HomePage
