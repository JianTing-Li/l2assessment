import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import AnalysisDetails from '../components/AnalysisDetails'
import { CategoryBadge, UrgencyBadge, ReviewBadge, FallbackBadge, ConfidenceBadge } from '../components/Badges'
import { addToHistory, loadHistory, updateHistoryEntry } from '../utils/storage'
import { loadSettings, triageContext } from '../utils/settings'
import { triageMessage, triageBatch } from '../utils/triage'
import { applyCorrection, needsReview, URGENCY_RANK } from '../utils/corrections'
import { splitBatch, messagesFromCsv, MAX_BATCH } from '../utils/extract'

const truncate = (text, length) => (text.length > length ? `${text.slice(0, length).trimEnd()}…` : text)

function Spinner() {
  return (
    <svg className="mr-2 h-5 w-5 animate-spin" viewBox="0 0 24 24" aria-hidden="true">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  )
}

function Tab({ active, onClick, children }) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={`rounded-md px-4 py-2 text-sm font-semibold ${active ? 'bg-white text-blue-700 shadow' : 'text-gray-600 hover:text-gray-900'}`}
    >
      {children}
    </button>
  )
}

function AnalyzePage() {
  const location = useLocation()
  const [settings] = useState(loadSettings)
  const context = triageContext(settings)
  const categoryNames = settings.categories.map(c => c.name)

  const [mode, setMode] = useState('single')
  const [message, setMessage] = useState(() => location.state?.example || '')
  const [result, setResult] = useState(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  const [batchText, setBatchText] = useState('')
  const [csvFile, setCsvFile] = useState(null) // { name, messages }
  const [batchResults, setBatchResults] = useState([])
  const [progress, setProgress] = useState(null)
  const [expandedId, setExpandedId] = useState(null)

  const allBatchMessages = csvFile ? csvFile.messages : splitBatch(batchText)
  const batchMessages = allBatchMessages.slice(0, MAX_BATCH)

  const handleAnalyze = async () => {
    if (!message.trim()) {
      setError('Enter a customer message to analyze.')
      return
    }
    setError('')
    setIsLoading(true)
    setResult(null)
    try {
      const entry = await triageMessage(message.trim(), settings, loadHistory())
      addToHistory([entry])
      setResult(entry)
    } catch (err) {
      console.error('Error analyzing message:', err)
      setError('Something went wrong analyzing this message. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleBatch = async () => {
    if (batchMessages.length === 0) {
      setError('Add at least one message, separated by blank lines, or upload a CSV.')
      return
    }
    setError('')
    setIsLoading(true)
    setBatchResults([])
    setProgress({ done: 0, total: batchMessages.length })
    try {
      const entries = await triageBatch(batchMessages, settings, loadHistory(), {
        onProgress: (done, total) => setProgress({ done, total }),
      })
      addToHistory(entries)
      setBatchResults(entries)
    } catch (err) {
      console.error('Error analyzing batch:', err)
      setError('Something went wrong analyzing the batch. Please try again.')
    } finally {
      setIsLoading(false)
      setProgress(null)
    }
  }

  const handleFile = async event => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    if (file.size > 2_000_000) {
      setError('That file is over 2 MB. Split it into smaller files.')
      return
    }
    const text = await file.text()
    const messages = /\.csv$/i.test(file.name) ? messagesFromCsv(text) : splitBatch(text)
    if (messages.length === 0) {
      setError(`No messages found in ${file.name}.`)
      return
    }
    setError('')
    setCsvFile({ name: file.name, messages })
  }

  const correct = (entry, changes) => {
    const next = applyCorrection(entry, changes, context)
    updateHistoryEntry(entry.id, next)
    return next
  }
  const saveReply = (entry, suggestedReply) => {
    updateHistoryEntry(entry.id, { suggestedReply })
    return { ...entry, suggestedReply }
  }
  const replaceBatchEntry = next => setBatchResults(list => list.map(item => (item.id === next.id ? next : item)))

  const sortedBatch = [...batchResults].sort((a, b) => URGENCY_RANK[a.urgency] - URGENCY_RANK[b.urgency])
  const batchSummary = {
    High: batchResults.filter(r => r.urgency === 'High').length,
    review: batchResults.filter(needsReview).length,
    fallback: batchResults.filter(r => r.usedFallback).length,
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="mx-auto max-w-4xl px-4">
        <div className="mb-6 rounded-lg bg-white p-6 shadow-md">
          <h1 className="mb-2 text-2xl font-bold text-gray-900">Analyze customer messages</h1>
          <p className="mb-4 text-gray-600">Get a category, urgency, route, next step and draft reply for each message.</p>

          <div role="tablist" className="mb-5 inline-flex rounded-lg bg-gray-100 p-1">
            <Tab active={mode === 'single'} onClick={() => { setMode('single'); setError('') }}>One message</Tab>
            <Tab active={mode === 'batch'} onClick={() => { setMode('batch'); setError('') }}>Batch</Tab>
          </div>

          {mode === 'single' ? (
            <div className="mb-4">
              <label htmlFor="message" className="mb-2 block text-sm font-semibold text-gray-700">Customer message</label>
              <textarea
                id="message"
                value={message}
                onChange={e => setMessage(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && !isLoading) handleAnalyze()
                }}
                placeholder="Paste customer message here..."
                className="h-40 w-full rounded-lg border border-gray-300 p-3 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                disabled={isLoading}
              />
              <div className="mt-1 flex justify-between text-sm text-gray-500">
                <span>{message.length} characters</span>
                <span className="hidden sm:inline">Ctrl/⌘ + Enter to analyze</span>
              </div>
            </div>
          ) : (
            <div className="mb-4 space-y-3">
              {csvFile ? (
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">
                  <span>Loaded <strong>{csvFile.messages.length}</strong> messages from {csvFile.name}</span>
                  <button type="button" className="font-semibold underline" onClick={() => setCsvFile(null)}>Remove file</button>
                </div>
              ) : (
                <>
                  <label htmlFor="batch" className="block text-sm font-semibold text-gray-700">Messages, separated by a blank line</label>
                  <textarea
                    id="batch"
                    value={batchText}
                    onChange={e => setBatchText(e.target.value)}
                    placeholder={'First customer message...\n\nSecond customer message...'}
                    className="h-48 w-full rounded-lg border border-gray-300 p-3 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                    disabled={isLoading}
                  />
                </>
              )}
              <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-gray-600">
                <label className="cursor-pointer font-semibold text-blue-700 hover:text-blue-900">
                  Upload CSV or text file
                  <input type="file" accept=".csv,.txt,text/csv,text/plain" className="sr-only" onChange={handleFile} disabled={isLoading} />
                </label>
                <span>
                  {batchMessages.length} message{batchMessages.length === 1 ? '' : 's'}
                  {allBatchMessages.length > MAX_BATCH && ` (only the first ${MAX_BATCH} of ${allBatchMessages.length} will be analyzed)`}
                </span>
              </div>
              <p className="text-xs text-gray-500">CSV files use the column named “message”, “body” or “text”, or else the first column.</p>
            </div>
          )}

          {error && <p role="alert" className="mb-3 text-sm font-semibold text-red-700">{error}</p>}

          <div className="flex gap-3">
            <button
              type="button"
              onClick={mode === 'single' ? handleAnalyze : handleBatch}
              disabled={isLoading}
              className={`flex flex-1 items-center justify-center rounded-lg py-3 font-semibold ${isLoading ? 'cursor-not-allowed bg-gray-300 text-gray-500' : 'bg-blue-600 text-white hover:bg-blue-700'}`}
            >
              {isLoading ? (
                <><Spinner />{progress ? `Analyzing ${progress.done} of ${progress.total}...` : 'Analyzing...'}</>
              ) : mode === 'single' ? 'Analyze message' : `Analyze ${batchMessages.length || ''} message${batchMessages.length === 1 ? '' : 's'}`}
            </button>
            <button
              type="button"
              onClick={() => {
                setError('')
                if (mode === 'single') { setMessage(''); setResult(null) } else { setBatchText(''); setCsvFile(null); setBatchResults([]) }
              }}
              disabled={isLoading}
              className="rounded-lg border border-gray-300 px-6 py-3 font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              Clear
            </button>
          </div>
        </div>

        {mode === 'single' && result && (
          <div className="rounded-lg bg-white p-6 shadow-md">
            <h2 className="mb-4 text-xl font-bold text-gray-900">Analysis results</h2>
            <AnalysisDetails
              key={result.id}
              entry={result}
              categoryNames={categoryNames}
              onCorrect={changes => setResult(correct(result, changes))}
              onReplyChange={reply => setResult(saveReply(result, reply))}
            />
          </div>
        )}

        {mode === 'batch' && batchResults.length > 0 && (
          <div className="rounded-lg bg-white p-6 shadow-md">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-xl font-bold text-gray-900">Batch results</h2>
              <Link to="/history" className="text-sm font-semibold text-blue-700 hover:text-blue-900">Open the queue →</Link>
            </div>
            <p className="mb-4 text-sm text-gray-600">
              {batchResults.length} analyzed · {batchSummary.High} high urgency · {batchSummary.review} need review
              {batchSummary.fallback > 0 && ` · ${batchSummary.fallback} used keyword fallback`}
            </p>
            <ul className="divide-y divide-gray-200">
              {sortedBatch.map(item => (
                <li key={item.id}>
                  <button
                    type="button"
                    aria-expanded={expandedId === item.id}
                    onClick={() => setExpandedId(expandedId === item.id ? null : item.id)}
                    className="flex w-full items-start justify-between gap-3 py-3 text-left hover:bg-gray-50"
                  >
                    <div className="min-w-0">
                      <div className="truncate text-gray-800">“{truncate(item.message, 120)}”</div>
                      <div className="mt-1 flex flex-wrap gap-2">
                        <UrgencyBadge urgency={item.urgency} />
                        <CategoryBadge category={item.category} />
                        <ConfidenceBadge confidence={item.confidence} />
                        {needsReview(item) && <ReviewBadge />}
                        {item.usedFallback && <FallbackBadge />}
                      </div>
                    </div>
                    <span className="text-gray-400" aria-hidden="true">{expandedId === item.id ? '▲' : '▼'}</span>
                  </button>
                  {expandedId === item.id && (
                    <div className="mb-3 rounded-lg bg-gray-50 p-4">
                      <AnalysisDetails
                        key={item.id}
                        entry={item}
                        categoryNames={categoryNames}
                        showMessage
                        onCorrect={changes => replaceBatchEntry(correct(item, changes))}
                        onReplyChange={reply => replaceBatchEntry(saveReply(item, reply))}
                      />
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  )
}

export default AnalyzePage
