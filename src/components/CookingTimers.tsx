import { useEffect, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { ChevronDown, Minus, Pause, Play, Plus, Timer, X } from 'lucide-react'
import { useTimers } from '../context/TimerContext'
import { remainingMs, timerLabel, timerSummary, type CookingTimer } from '../lib/cookingTimers'
import { formatClock } from '../lib/stepTimer'

const MINUTE = 60_000

// Én klokke med navn, gjenstående tid og knapper for −1/+1 min, pause og avbryt.
// "large" brukes på steget i kokemodus, ellers den kompakte varianten i klokkelisten.
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
              <Timer size={18} strokeWidth={2.5} aria-hidden="true" /> Stopp
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

// Utenfor kokemodus ligger klokkene bak en rund stoppeklokkeknapp nede til venstre,
// så de aldri dekker tilbakeknappen eller annen navigasjon øverst. Tallet på
// knappen sier hvor mange som går, og et trykk åpner listen med alle klokkene.
// Når en klokke ringer, åpnes listen av seg selv så man ser hvilket steg det
// gjelder. I kokemodus vises klokkene der i stedet (se KokemodusPage).
export function TimerTray() {
  const { timers, now, pushState } = useTimers()
  const location = useLocation()
  const [open, setOpen] = useState(false)
  const inCookingMode = /^\/oppskrift\/[^/]+\/kok$/.test(location.pathname)
  const visible = timers.length > 0 && !inCookingMode
  const { count, ringing, next } = timerSummary(timers, now)

  useEffect(() => {
    document.body.classList.toggle('has-timer-button', visible)
    return () => document.body.classList.remove('has-timer-button')
  }, [visible])

  // Åpne listen når en ny klokke begynner å ringe.
  const ringingCount = ringing.length
  const previousRinging = useRef(ringingCount)
  useEffect(() => {
    if (ringingCount > previousRinging.current) setOpen(true)
    previousRinging.current = ringingCount
  }, [ringingCount])

  useEffect(() => {
    if (!visible) setOpen(false)
  }, [visible])

  if (!visible) return null

  const label =
    ringingCount > 0
      ? `Tiden er ute: ${ringing.map(timerLabel).join(', ')}`
      : count === 1
        ? 'Én nedtelling går. Vis nedtellingen'
        : `${count} nedtellinger går. Vis nedtellingene`

  return (
    <>
      <button
        type="button"
        className={'timer-fab' + (ringingCount > 0 ? ' timer-fab-ringing' : '')}
        onClick={() => setOpen((o) => !o)}
        aria-label={label}
        aria-expanded={open}
        aria-controls="timer-panel"
      >
        <Timer size={24} strokeWidth={2.5} aria-hidden="true" />
        {!open && ringingCount === 0 && next && (
          <span className="timer-fab-time">{formatClock(remainingMs(next, now))}</span>
        )}
        {count > 1 && <span className="timer-fab-badge">{count}</span>}
      </button>

      {open && <TimerPanel timers={timers} pushState={pushState} onClose={() => setOpen(false)} />}
    </>
  )
}

// Listen med klokker som åpnes fra bjella, både utenfor og i kokemodus.
export function TimerPanel({ timers, pushState, onClose }: { timers: CookingTimer[]; pushState: string; onClose: () => void }) {
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="timer-panel-backdrop" onClick={onClose}>
      <div
        id="timer-panel"
        className="timer-panel"
        role="dialog"
        aria-label="Nedtellinger"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="timer-panel-header">
          <h2>Nedtellinger</h2>
          <button type="button" className="cooking-timer-button" onClick={onClose} aria-label="Lukk">
            <ChevronDown size={20} strokeWidth={2.5} aria-hidden="true" />
          </button>
        </div>
        {timers.map((timer) => (
          <TimerCard key={timer.id} timer={timer} />
        ))}
        <PushHint state={pushState} />
      </div>
    </div>
  )
}

// I kokemodus ligger klokker fra tidligere steg og andre oppskrifter bak en
// liten stoppeklokke øverst. Tallet sier hvor mange som går.
export function KokemodusBell({ count, open, onToggle }: { count: number; open: boolean; onToggle: () => void }) {
  if (count === 0) return null
  return (
    <button
      type="button"
      className="kokemodus-bell"
      onClick={onToggle}
      aria-label={count === 1 ? 'Én nedtelling går. Vis nedtellingen' : `${count} nedtellinger går. Vis nedtellingene`}
      aria-expanded={open}
      aria-controls="timer-panel"
    >
      <Timer size={18} strokeWidth={2.5} aria-hidden="true" />
      {count > 1 && <span className="kokemodus-bell-badge">{count}</span>}
    </button>
  )
}

// Dukker opp i kokemodus når en klokke har ett minutt eller mindre igjen.
export function TimerPill({ timer, onOpen }: { timer: CookingTimer; onOpen: () => void }) {
  const { now } = useTimers()
  return (
    <button type="button" className="kokemodus-timer-pill" onClick={onOpen} aria-label={`${timer.recipeTitle || timerLabel(timer)}: ${formatClock(remainingMs(timer, now))} igjen. Vis nedtellingene`}>
      <span className="kokemodus-timer-pill-name">{timer.recipeTitle || `Steg ${timer.stepIndex + 1}`}</span>
      <span className="kokemodus-timer-pill-clock">{formatClock(remainingMs(timer, now))}</span>
    </button>
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
