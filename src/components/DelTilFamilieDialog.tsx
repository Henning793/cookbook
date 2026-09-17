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
    <div className="delete-confirm">
      {done ? (
        <>
          <p>Delingsforespørsel sendt. Familien må godta den før de får tilgang.</p>
          <button type="button" onClick={onClose}>
            Lukk
          </button>
        </>
      ) : (
        <form onSubmit={handleSubmit}>
          <p>Lim inn familiekoden til familien du vil dele med.</p>
          <input
            type="text"
            required
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="Familiekode"
          />
          <div className="form-actions">
            <button type="button" onClick={onClose}>
              Avbryt
            </button>
            <button type="submit" disabled={busy}>
              {busy ? 'Sender...' : 'Send delingsforespørsel'}
            </button>
          </div>
          {error && <p className="status-message">{error}</p>}
        </form>
      )}
    </div>
  )
}
