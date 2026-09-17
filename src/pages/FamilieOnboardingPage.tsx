import { useState } from 'react'
import { createFamily, joinFamilyByCode } from '../lib/families'
import { useApp } from '../context/AppContext'

export function FamilieOnboardingPage() {
  const { reloadFamily } = useApp()
  const [mode, setMode] = useState<'create' | 'join'>('create')
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function handleCreate(event: React.FormEvent) {
    event.preventDefault()
    setError(null)
    setBusy(true)
    try {
      await createFamily(name.trim())
      reloadFamily()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Noe gikk feil.')
    } finally {
      setBusy(false)
    }
  }

  async function handleJoin(event: React.FormEvent) {
    event.preventDefault()
    setError(null)
    setBusy(true)
    try {
      await joinFamilyByCode(code.trim())
      reloadFamily()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Noe gikk feil.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="page familie-onboarding-page">
      <h1 className="oppskrift-title">Bli med i en familie</h1>
      <p className="oppskrift-description">
        For å bruke Kokeboka må du opprette en ny familiegruppe eller bli med i en du har fått en kode til.
      </p>

      <div className="form-actions">
        <button type="button" onClick={() => setMode('create')} disabled={mode === 'create'}>
          Opprett familie
        </button>
        <button type="button" onClick={() => setMode('join')} disabled={mode === 'join'}>
          Bli med med kode
        </button>
      </div>

      {mode === 'create' ? (
        <form onSubmit={handleCreate}>
          <label htmlFor="familie-navn">Familiens navn</label>
          <input
            id="familie-navn"
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <button type="submit" className="cta-button" disabled={busy}>
            {busy ? 'Oppretter...' : 'Opprett familie'}
          </button>
        </form>
      ) : (
        <form onSubmit={handleJoin}>
          <label htmlFor="familie-kode">Familiekode</label>
          <input
            id="familie-kode"
            type="text"
            required
            value={code}
            onChange={(e) => setCode(e.target.value)}
          />
          <button type="submit" className="cta-button" disabled={busy}>
            {busy ? 'Blir med...' : 'Bli med i familien'}
          </button>
        </form>
      )}

      {error && <p className="status-message">{error}</p>}
    </div>
  )
}
