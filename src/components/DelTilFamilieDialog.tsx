import { useState } from 'react'
import { startShare } from '../lib/shares'
import type { ShareType } from '../types'

interface Props {
  shareType: ShareType
  recipeId?: string
  collectionId?: string
  onClose: () => void
}

export function DelTilFamilieDialog({ shareType, recipeId, collectionId, onClose }: Props) {
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setError(null)
    setBusy(true)
    try {
      await startShare(code.trim(), shareType, recipeId ?? null, collectionId ?? null)
      setDone(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Noe gikk feil.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="del-dialog-backdrop" onClick={onClose}>
      <div className="del-dialog-sheet" onClick={(e) => e.stopPropagation()}>
        {done ? (
          <div className="del-dialog-done">
            <p className="del-dialog-body">
              Delingsforespørsel sendt. Familien må godta den før de får tilgang.
            </p>
            <button type="button" className="cta-button" onClick={onClose}>
              Lukk
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <h2 className="del-dialog-title">Del med en familie</h2>
            <p className="del-dialog-body">Lim inn familiekoden til familien du vil dele med.</p>
            <input
              type="text"
              required
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="Familiekode"
              className="del-dialog-input"
            />
            <div className="del-dialog-actions">
              <button type="button" className="del-dialog-cancel" onClick={onClose}>
                Avbryt
              </button>
              <button type="submit" className="del-dialog-submit" disabled={busy}>
                {busy ? 'Sender...' : 'Send forespørsel'}
              </button>
            </div>
            {error && <p className="status-message">{error}</p>}
          </form>
        )}
      </div>
    </div>
  )
}
