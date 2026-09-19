import { useState, type FormEvent } from 'react'

interface Props {
  initialValue: string
  onConfirm: (unit: string) => void
  onUseStandard?: () => void
  onClose: () => void
}

export function CustomUnitDialog({ initialValue, onConfirm, onUseStandard, onClose }: Props) {
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
          {onUseStandard && (
            <button type="button" className="custom-unit-standard-link" onClick={onUseStandard}>
              Velg en standardenhet i stedet
            </button>
          )}
        </form>
      </div>
    </div>
  )
}
