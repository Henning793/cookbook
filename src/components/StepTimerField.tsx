import { guessStepSeconds, timerOverride } from '../lib/stepTimer'

function minutesText(seconds: number): string {
  return (Math.round((seconds / 60) * 10) / 10).toLocaleString('nb-NO')
}

// Nedtelling for ett steg i redigeringsskjemaet. Tom = bruk tiden appen
// gjetter fra teksten (vises som forslag), et tall overstyrer, og "Ingen"
// fjerner nedtellingen når gjettingen er feil.
export function StepTimerField({
  step,
  onChange,
}: {
  step: string
  onChange: (minutes: number | null | undefined) => void
}) {
  const override = timerOverride(step)
  const guess = guessStepSeconds(step)

  if (override === null) {
    return (
      <div className="step-timer-field">
        <span className="step-timer-label">Ingen nedtelling</span>
        <button type="button" className="step-timer-link" onClick={() => onChange(undefined)}>
          Angre
        </button>
      </div>
    )
  }

  return (
    <div className="step-timer-field">
      <label className="step-timer-label">
        Nedtelling
        <input
          type="number"
          inputMode="decimal"
          min="0.5"
          step="any"
          className="step-timer-input"
          value={override ?? ''}
          placeholder={guess != null ? minutesText(guess) : '–'}
          onChange={(e) => {
            const value = Number(e.target.value.replace(',', '.'))
            onChange(e.target.value.trim() === '' || !(value > 0) ? undefined : value)
          }}
        />
        min
      </label>
      {override === undefined && guess != null && <span className="step-timer-hint">fra teksten</span>}
      {(override !== undefined || guess != null) && (
        <button type="button" className="step-timer-link" onClick={() => onChange(null)}>
          Ingen
        </button>
      )}
    </div>
  )
}
