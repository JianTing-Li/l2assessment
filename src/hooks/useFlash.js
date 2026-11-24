import { useCallback, useEffect, useRef, useState } from 'react'

/** A short-lived inline message ("Copied", "Saved") instead of alert(). */
export function useFlash(duration = 2500) {
  const [flash, setFlash] = useState(null)
  const timer = useRef(null)

  const show = useCallback((text, tone = 'success') => {
    clearTimeout(timer.current)
    setFlash({ text, tone })
    timer.current = setTimeout(() => setFlash(null), duration)
  }, [duration])

  useEffect(() => () => clearTimeout(timer.current), [])

  return [flash, show]
}
