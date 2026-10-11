import { useState, type FormEvent } from 'react'
import { UNITS } from '../lib/units'

interface Props {
  initialValue: string
  onConfirm: (unit: string) => void
  onPickStandard?: (unit: string) => void
  onClose: () => void
}

export function CustomUnitDialog({ initialValue, onConfirm, onPickStandard, onClose }: Props) {
  const [value, setValue] = useState(initialValue)
  const trimmed = value.trim()

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (!trimmed) return
    onConfirm(trimmed)
  }

  return (
    <div className="del-dialog-backdrop" onClick={onClose}>
      <div className="del-dialog-sheet" onClick={(e) => e.stopPropagation()}>
        <form onSubmit={handleSubmit}>
          <h2 className="del-dialog-title">Egendefinert enhet</h2>
          <p className="del-dialog-body">Skriv inn enheten du vil bruke, for eksempel «stjerne» eller «neve».</p>
          <input
            type="text"
            autoFocus
            className="del-dialog-input"
            placeholder="Enhet"
            value={value}
            onChange={(e) => setValue(e.target.value)}
          />
          <div className="del-dialog-actions">
            <button type="button" className="del-dialog-cancel" onClick={onClose}>
              Avbryt
            </button>
            <button type="submit" className="del-dialog-submit" disabled={!trimmed}>
              Bruk enhet
            </button>
          </div>
          {onPickStandard && (
            <div className="custom-unit-standard">
              <p className="custom-unit-standard-label">Eller velg en standardenhet</p>
              <div className="custom-unit-standard-options">
                {UNITS.map((unit) => (
                  <button
                    type="button"
                    key={unit}
                    className="custom-unit-standard-option"
                    onClick={() => onPickStandard(unit)}
                  >
                    {unit}
                  </button>
                ))}
              </div>
            </div>
          )}
        </form>
      </div>
    </div>
  )
}
