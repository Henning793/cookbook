import { useEffect, useState } from 'react'
import { copyMenuWeek, listMenuDaysBetween } from '../lib/menuDays'
import { addWeeks, copyTargetWeeks, currentWeekStart, weekNumber, weekRangeLabel } from '../lib/menuWeeks'
import { errorMessage } from '../lib/errorMessage'

interface Props {
  familyId: string | null
  from: string
  onClose: () => void
  onCopied: (to: string) => void
}

// «Kopier uken til …»: velg en av de neste ukene. Uker som allerede har en
// plan er merket, siden de blir overskrevet.
export function CopyWeekDialog({ familyId, from, onClose, onCopied }: Props) {
  const [weeks] = useState(() => copyTargetWeeks(from))
  const [planned, setPlanned] = useState<Map<string, number> | null>(null)
  const [selected, setSelected] = useState(() => {
    const next = addWeeks(from, 1)
    return weeks.includes(next) ? next : weeks[0]
  })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    listMenuDaysBetween(familyId, weeks[0], weeks[weeks.length - 1])
      .then((rows) => {
        const counts = new Map<string, number>()
        for (const row of rows) {
          if (row.entry_type && row.week_start) counts.set(row.week_start, (counts.get(row.week_start) ?? 0) + 1)
        }
        setPlanned(counts)
      })
      .catch(() => setPlanned(new Map()))
  }, [familyId, weeks])

  async function handleCopy() {
    setBusy(true)
    setError(null)
    try {
      await copyMenuWeek(familyId, from, selected)
      onCopied(selected)
    } catch (err) {
      setError(`Kunne ikke kopiere: ${errorMessage(err)}`)
      setBusy(false)
    }
  }

  const thisWeek = currentWeekStart()

  return (
    <div className="del-dialog-backdrop" onClick={() => !busy && onClose()}>
      <div className="del-dialog-sheet" onClick={(e) => e.stopPropagation()}>
        <h2 className="del-dialog-title">Kopier uke {weekNumber(from)}</h2>
        <p className="del-dialog-body">Middagene og porsjonene kopieres til uken du velger.</p>
        <div className="copy-week-options" role="radiogroup" aria-label="Kopier til">
          {weeks.map((week) => {
            const count = planned?.get(week) ?? 0
            return (
              <button
                type="button"
                key={week}
                role="radio"
                aria-checked={selected === week}
                className={`copy-week-option${selected === week ? ' copy-week-option-selected' : ''}`}
                onClick={() => setSelected(week)}
              >
                <span className="copy-week-radio" aria-hidden="true" />
                <span className="copy-week-text">
                  <span className="copy-week-title">
                    Uke {weekNumber(week)}
                    {week === thisWeek && ' · denne uken'}
                  </span>
                  <span className="copy-week-sub">
                    {weekRangeLabel(week)}
                    {planned &&
                      (count > 0
                        ? ` · ${count} ${count === 1 ? 'dag er planlagt og blir' : 'dager er planlagt og blir'} overskrevet`
                        : ' · tom')}
                  </span>
                </span>
              </button>
            )
          })}
        </div>
        {error && <p className="del-dialog-body">{error}</p>}
        <div className="del-dialog-actions">
          <button type="button" className="del-dialog-cancel" onClick={onClose} disabled={busy}>
            Avbryt
          </button>
          <button type="button" className="del-dialog-submit" onClick={handleCopy} disabled={busy}>
            {busy ? 'Kopierer...' : 'Kopier'}
          </button>
        </div>
      </div>
    </div>
  )
}
