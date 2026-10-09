import { Timer } from 'lucide-react'
import { formatDuration, guessStepSeconds, timerOverride } from '../lib/stepTimer'

function minutesText(seconds: number): string {
  return (Math.round((seconds / 60) * 10) / 10).toLocaleString('nb-NO')
}

// Nedtelling for ett steg i redigeringsskjemaet. Har steget en tid (gjettet
// fra teksten eller satt her), vises den som en liten brikke som kan trykkes
// på for å endre. Steg uten tid viser ingenting; der åpnes feltet med
// klokkeknappen ved siden av steget (se RecipeForm).
export function StepTimerField({
  step,
  open,
  onOpen,
  onClose,
  onChange,
}: {
  step: string
  open: boolean
  onOpen: () => void
  onClose: () => void
  onChange: (minutes: number | null | undefined) => void
}) {
  const override = timerOverride(step)
  const guess = guessStepSeconds(step)
  const seconds = override === null ? null : override !== undefined ? override * 60 : guess

  if (!open) {
    if (seconds != null) {
      return (
        <button type="button" className="step-timer-chip" onClick={onOpen} aria-label={`Nedtelling ${formatDuration(seconds)}, endre`}>
          <Timer size={14} strokeWidth={2.5} aria-hidden="true" />
          {formatDuration(seconds)}
        </button>
      )
    }
    // Gjettingen er slått av: vis det, så det kan angres.
    if (override === null && guess != null) {
      return (
        <button type="button" className="step-timer-chip step-timer-chip-off" onClick={onOpen}>
          <Timer size={14} strokeWidth={2.5} aria-hidden="true" />
          Ingen nedtelling
        </button>
      )
    }
    return null
  }

  return (
    <div className="step-timer-field">
      <label className="step-timer-label">
        <Timer size={14} strokeWidth={2.5} aria-hidden="true" />
        Nedtelling
        <input
          type="number"
          inputMode="decimal"
          min="0.5"
          step="any"
          className="step-timer-input"
          autoFocus
          value={typeof override === 'number' ? override : ''}
          placeholder={guess != null ? minutesText(guess) : ''}
          onChange={(e) => {
            const value = Number(e.target.value.replace(',', '.'))
            onChange(e.target.value.trim() === '' || !(value > 0) ? undefined : value)
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === 'Escape') {
              e.preventDefault()
              onClose()
            }
          }}
        />
        min
      </label>
      {override === undefined && guess != null && <span className="step-timer-hint">fra teksten</span>}
      {override === null ? (
        <button type="button" className="step-timer-link" onClick={() => onChange(undefined)}>
          Bruk tiden fra teksten
        </button>
      ) : (
        (override !== undefined || guess != null) && (
          <button
            type="button"
            className="step-timer-link"
            onClick={() => {
              onChange(guess != null ? null : undefined)
              onClose()
            }}
          >
            Fjern
          </button>
        )
      )}
      <button type="button" className="step-timer-link" onClick={onClose}>
        Ferdig
      </button>
    </div>
  )
}
