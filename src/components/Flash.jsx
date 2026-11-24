const TONES = {
  success: 'bg-green-50 text-green-800 border-green-200',
  error: 'bg-red-50 text-red-800 border-red-200',
  info: 'bg-blue-50 text-blue-800 border-blue-200',
}

/** Inline status message; announced to screen readers. */
export default function Flash({ flash }) {
  return (
    <div role="status" aria-live="polite" className="min-h-0">
      {flash && (
        <span className={`inline-block rounded-md border px-3 py-1 text-sm ${TONES[flash.tone] || TONES.info}`}>
          {flash.text}
        </span>
      )}
    </div>
  )
}
