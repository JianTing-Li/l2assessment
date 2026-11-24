import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom'
import Navigation from './components/Navigation'
import HomePage from './pages/HomePage'
import AnalyzePage from './pages/AnalyzePage'
import HistoryPage from './pages/HistoryPage'
import DashboardPage from './pages/DashboardPage'
import SettingsPage from './pages/SettingsPage'

function NotFound() {
  return (
    <div className="mx-auto max-w-xl px-4 py-16 text-center">
      <h1 className="mb-2 text-2xl font-bold text-gray-900">Page not found</h1>
      <Link to="/" className="font-semibold text-blue-700 hover:text-blue-900">Back to home</Link>
    </div>
  )
}

function App() {
  return (
    <Router>
      <div className="min-h-screen bg-gray-50">
        <Navigation />
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/analyze" element={<AnalyzePage />} />
          <Route path="/history" element={<HistoryPage />} />
          <Route path="/queue" element={<HistoryPage />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </div>
    </Router>
  )
}

export default App
