import { useCallback, useEffect, useRef, useState } from 'react'
import { login } from '../api'

const MAX_DIGITS = 8
/** Code lengths that are tried automatically as you type, without pressing Enter. */
const AUTO_TRY = [4, 6]

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'back', '0', 'enter'] as const

export default function Keypad({ onLogin }: { onLogin: () => void }) {
  const [code, setCode] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const [shake, setShake] = useState(false)
  const [busy, setBusy] = useState(false)
  const latest = useRef('')

  const attempt = useCallback(
    async (value: string, explicit: boolean) => {
      setBusy(explicit)
      try {
        const user = await login(value)
        if (user) return onLogin()
        if (!explicit || latest.current !== value) return // silent auto-try, or they've kept typing
        setMessage('Wrong code')
        setShake(true)
        setCode('')
        latest.current = ''
      } catch (e) {
        setMessage((e as Error).message)
        setCode('')
        latest.current = ''
      } finally {
        setBusy(false)
      }
    },
    [onLogin],
  )

  const press = useCallback(
    (key: (typeof KEYS)[number]) => {
      if (busy) return
      setMessage(null)
      if (key === 'back') {
        latest.current = latest.current.slice(0, -1)
      } else if (key === 'enter') {
        if (latest.current) attempt(latest.current, true)
        return
      } else if (latest.current.length < MAX_DIGITS) {
        latest.current += key
        if (AUTO_TRY.includes(latest.current.length)) attempt(latest.current, false)
      }
      setCode(latest.current)
    },
    [attempt, busy],
  )

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return
      if (/^[0-9]$/.test(e.key)) press(e.key as (typeof KEYS)[number])
      else if (e.key === 'Backspace') press('back')
      else if (e.key === 'Enter') press('enter')
      else if (e.key === 'Escape') {
        latest.current = ''
        setCode('')
      } else return
      e.preventDefault()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [press])

  return (
    <main className="keypad-screen">
      <h1>Where Is It</h1>
      <div
        className={`code-dots${shake ? ' shake' : ''}`}
        onAnimationEnd={() => setShake(false)}
        aria-live="polite"
        aria-label={`${code.length} digits entered`}
      >
        {Array.from({ length: Math.max(4, code.length) }, (_, i) => (
          <span key={i} className={i < code.length ? 'filled' : ''} />
        ))}
      </div>
      <p className="keypad-message" role="alert">{message ?? ' '}</p>
      <div className="keypad">
        {KEYS.map((k) => (
          <button
            key={k}
            type="button"
            className={k === 'enter' ? 'key enter' : k === 'back' ? 'key back' : 'key'}
            onClick={() => press(k)}
            aria-label={k === 'back' ? 'Delete' : k === 'enter' ? 'Enter' : k}
            disabled={busy || (k === 'enter' && !code)}
          >
            {k === 'back' ? '⌫' : k === 'enter' ? '✓' : k}
          </button>
        ))}
      </div>
    </main>
  )
}
