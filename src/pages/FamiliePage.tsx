import { useNavigate } from 'react-router-dom'
import { ChevronLeft } from 'lucide-react'
import { useState } from 'react'
import { useApp } from '../context/AppContext'
import { removeMember, regenerateCode, leaveFamily } from '../lib/families'
import { revokeShare } from '../lib/shares'

export function FamiliePage() {
  const navigate = useNavigate()
  const { family, members, myRole, profiles, session, outgoingShares, reloadFamily } = useApp()
  const [codeCopied, setCodeCopied] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Task 11 (DelTilFamilieDialog) consumes this piece of state; this task only
  // wires up the trigger button below.
  const [showShareDialog, setShowShareDialog] = useState(false)

  if (!family) {
    return (
      <div className="page familie-page">
        <p className="status-message">Laster familie...</p>
      </div>
    )
  }

  function nameFor(userId: string) {
    return profiles.find((p) => p.id === userId)?.display_name ?? 'Ukjent'
  }

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(family!.invite_code)
      setCodeCopied(true)
      setTimeout(() => setCodeCopied(false), 1500)
    } catch {
      // Utklippstavle utilgjengelig - ingen bekreftelse å vise, men ikke krasj.
    }
  }

  async function handleRegenerate() {
    setBusy(true)
    setError(null)
    try {
      await regenerateCode(family!.id)
      reloadFamily()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Noe gikk feil.')
    } finally {
      setBusy(false)
    }
  }

  async function handleRemove(userId: string) {
    setBusy(true)
    setError(null)
    try {
      await removeMember(family!.id, userId)
      reloadFamily()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Noe gikk feil.')
    } finally {
      setBusy(false)
    }
  }

  async function handleLeave() {
    setBusy(true)
    setError(null)
    try {
      await leaveFamily()
      reloadFamily()
      navigate('/')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Noe gikk feil.')
    } finally {
      setBusy(false)
    }
  }

  async function handleRevoke(shareId: string) {
    setBusy(true)
    setError(null)
    try {
      await revokeShare(shareId)
      reloadFamily()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Noe gikk feil.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="page familie-page">
      <nav className="nav-bar">
        <button type="button" className="nav-link" onClick={() => navigate('/meg')}>
          <ChevronLeft size={14} strokeWidth={2.75} aria-hidden="true" />
          Meg
        </button>
      </nav>

      <h1 className="oppskrift-title">{family.name}</h1>

      {error && <p className="status-message">{error}</p>}

      <h2 className="section-kicker">Invitasjonskode</h2>
      <p className="oppskrift-description">
        Del denne koden med noen for å invitere dem til familien, eller for å starte en deling med en annen familie.
      </p>
      <div className="form-actions">
        <code>{family.invite_code}</code>
        <button type="button" onClick={copyCode}>
          {codeCopied ? 'Kopiert!' : 'Kopier'}
        </button>
        {myRole === 'admin' && (
          <button type="button" onClick={handleRegenerate} disabled={busy}>
            Generer ny kode
          </button>
        )}
      </div>

      <h2 className="section-kicker">Medlemmer</h2>
      <ul>
        {members.map((member) => (
          <li key={member.user_id} className="samling-recipe-row">
            <span>
              {nameFor(member.user_id)} {member.role === 'admin' && '(admin)'}
            </span>
            {myRole === 'admin' && member.user_id !== session?.user.id && (
              <button type="button" onClick={() => handleRemove(member.user_id)} disabled={busy}>
                Fjern
              </button>
            )}
          </li>
        ))}
      </ul>

      <h2 className="section-kicker">Utgående delinger</h2>
      {outgoingShares.filter((s) => s.status === 'accepted' || s.status === 'pending').length === 0 ? (
        <p className="status-message">Ingen aktive delinger.</p>
      ) : (
        <ul>
          {outgoingShares
            .filter((s) => s.status === 'accepted' || s.status === 'pending')
            .map((share) => (
              <li key={share.id} className="samling-recipe-row">
                <span>
                  {share.share_type === 'whole_family' ? 'Hele boken' : share.share_type} — {share.status}
                </span>
                <button type="button" onClick={() => handleRevoke(share.id)} disabled={busy}>
                  Trekk tilbake
                </button>
              </li>
            ))}
        </ul>
      )}

      <div className="form-actions">
        <button type="button" onClick={() => setShowShareDialog(true)}>
          Del med en annen familie
        </button>
      </div>
      {/* Task 11's DelTilFamilieDialog renders here, driven by showShareDialog. */}
      {showShareDialog && (
        <div className="familie-share-dialog-placeholder" onClick={() => setShowShareDialog(false)} />
      )}

      <button type="button" className="delete-confirm-button" onClick={handleLeave} disabled={busy}>
        Forlat familien
      </button>
    </div>
  )
}
