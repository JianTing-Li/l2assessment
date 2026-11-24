import { useState } from 'react'
import { Link, NavLink } from 'react-router-dom'

const LINKS = [
  { to: '/', label: 'Home', end: true },
  { to: '/analyze', label: 'Analyze' },
  { to: '/history', label: 'Queue' },
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/settings', label: 'Settings' },
]

const linkClass = ({ isActive }) =>
  `block rounded px-4 py-2 ${isActive ? 'bg-blue-700 font-semibold' : 'hover:bg-blue-500'}`

function Navigation() {
  const [open, setOpen] = useState(false)

  return (
    <nav className="bg-blue-600 text-white shadow-md">
      <div className="mx-auto max-w-7xl px-4">
        <div className="flex h-16 items-center justify-between">
          <Link to="/" className="flex items-center space-x-2 hover:opacity-80" onClick={() => setOpen(false)}>
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-2xl" aria-hidden="true">
              📧
            </div>
            <div>
              <div className="text-lg font-bold">Relay AI</div>
              <div className="text-xs text-blue-200">Customer Triage</div>
            </div>
          </Link>

          <div className="hidden space-x-1 md:flex">
            {LINKS.map(link => (
              <NavLink key={link.to} to={link.to} end={link.end} className={linkClass}>
                {link.label}
              </NavLink>
            ))}
          </div>

          <button
            type="button"
            className="rounded p-2 hover:bg-blue-500 md:hidden"
            aria-label={open ? 'Close menu' : 'Open menu'}
            aria-expanded={open}
            aria-controls="mobile-menu"
            onClick={() => setOpen(o => !o)}
          >
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              {open ? <path d="M6 18L18 6M6 6l12 12" /> : <path d="M4 6h16M4 12h16M4 18h16" />}
            </svg>
          </button>
        </div>

        {open && (
          <div id="mobile-menu" className="space-y-1 pb-3 md:hidden">
            {LINKS.map(link => (
              <NavLink key={link.to} to={link.to} end={link.end} className={linkClass} onClick={() => setOpen(false)}>
                {link.label}
              </NavLink>
            ))}
          </div>
        )}
      </div>
    </nav>
  )
}

export default Navigation
