import { useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Bell, Minus, Pause, Play, Plus, X } from 'lucide-react'
import { useTimers } from '../context/TimerContext'
import { remainingMs, timerLabel, type CookingTimer } from '../lib/cookingTimers'
import { formatClock } from '../lib/stepTimer'

const MINUTE = 60_000

// Én klokke med navn, gjenstående tid og knapper for −1/+1 min, pause og avbryt.
// "large" brukes på steget i kokemodus, ellers den kompakte varianten i stripen.
export function TimerCard({ timer, large = false, showLabel = true }: { timer: CookingTimer; large?: boolean; showLabel?: boolean }) {
  const { now, pause, resume, adjust, remove } = useTimers()
  const paused = timer.endsAt === null && !timer.ringing

  return (
    <div
      className={
        'cooking-timer' +
        (large ? ' cooking-timer-large' : '') +
        (timer.ringing ? ' cooking-timer-ringing' : '') +
        (paused ? ' cooking-timer-paused' : '')
      }
      role={timer.ringing ? 'alert' : undefined}
    >
      <div className="cooking-timer-info">
        {showLabel && (
          <Link className="cooking-timer-label" to={`/oppskrift/${timer.recipeId}/kok`}>
            {timerLabel(timer)}
          </Link>
        )}
        <span className="cooking-timer-clock" aria-live={timer.ringing ? 'assertive' : 'off'}>
          {timer.ringing ? 'Tiden er ute!' : formatClock(remainingMs(timer, now))}
          {paused && <span className="cooking-timer-state"> på pause</span>}
        </span>
      </div>

      <div className="cooking-timer-actions">
        {timer.ringing ? (
          <>
            <button type="button" className="cooking-timer-button" onClick={() => adjust(timer.id, MINUTE)} aria-label="Ett minutt til">
              <Plus size={18} strokeWidth={2.5} aria-hidden="true" />1
            </button>
            <button type="button" className="cooking-timer-stop" onClick={() => remove(timer.id)}>
              <Bell size={18} strokeWidth={2.5} aria-hidden="true" /> Stopp
            </button>
          </>
        ) : (
          <>
            <button type="button" className="cooking-timer-button" onClick={() => adjust(timer.id, -MINUTE)} aria-label="Ett minutt mindre">
              <Minus size={18} strokeWidth={2.5} aria-hidden="true" />
            </button>
            <button type="button" className="cooking-timer-button" onClick={() => adjust(timer.id, MINUTE)} aria-label="Ett minutt mer">
              <Plus size={18} strokeWidth={2.5} aria-hidden="true" />
            </button>
            <button
              type="button"
              className="cooking-timer-button"
              onClick={() => (paused ? resume(timer.id) : pause(timer.id))}
              aria-label={paused ? 'Fortsett' : 'Pause'}
            >
              {paused ? <Play size={18} strokeWidth={2.5} aria-hidden="true" /> : <Pause size={18} strokeWidth={2.5} aria-hidden="true" />}
            </button>
            <button type="button" className="cooking-timer-button" onClick={() => remove(timer.id)} aria-label="Avbryt nedtelling">
              <X size={18} strokeWidth={2.5} aria-hidden="true" />
            </button>
          </>
        )}
      </div>
    </div>
  )
}

// Stripe øverst på skjermen med alle klokker som går, så de synes på alle
// sider. I kokemodus vises de der i stedet (se KokemodusPage).
export function TimerTray() {
  const { timers, pushState } = useTimers()
  const location = useLocation()
  const inCookingMode = /^\/oppskrift\/[^/]+\/kok$/.test(location.pathname)
  const visible = timers.length > 0 && !inCookingMode

  useEffect(() => {
    document.body.classList.toggle('has-timer-tray', visible)
    return () => document.body.classList.remove('has-timer-tray')
  }, [visible])

  if (!visible) return null

  return (
    <div className="timer-tray" aria-label="Nedtellinger">
      {timers.map((timer) => (
        <TimerCard key={timer.id} timer={timer} />
      ))}
      <PushHint state={pushState} />
    </div>
  )
}

// Sier fra når varsel på låst skjerm ikke er mulig.
export function PushHint({ state }: { state: string }) {
  if (state === 'denied') {
    return <p className="timer-push-hint">Varsler er slått av for appen, så alarmen ringer bare når appen er åpen.</p>
  }
  if (state === 'unsupported') {
    return <p className="timer-push-hint">Alarmen ringer bare når appen er åpen. På iPhone må appen ligge på hjemskjermen for å varsle.</p>
  }
  return null
}
