import { useNavigate } from 'react-router-dom'
import { ChevronLeft } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useApp } from '../context/AppContext'
import { removeMember, regenerateCode, leaveFamily, getFamilyName } from '../lib/families'
import { revokeShare, respondToShare } from '../lib/shares'
import { DelTilFamilieDialog } from '../components/DelTilFamilieDialog'
import type { ShareType } from '../types'

function shareTypeLabel(shareType: ShareType): string {
  switch (shareType) {
    case 'recipe':
      return 'Oppskrift'
    case 'collection':
      return 'Samling'
    case 'whole_family':
      return 'Hele boken'
    default:
      return shareType
  }
}

export function FamiliePage() {
  const navigate = useNavigate()
  const {
    family,
    members,
    myRole,
    profiles,
    session,
    incomingShares,
    outgoingShares,
    reloadFamily,
    reload,
  } = useApp()
  const [codeCopied, setCodeCopied] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showWholeFamilyDialog, setShowWholeFamilyDialog] = useState(false)
  const [familyNames, setFamilyNames] = useState<Record<string, string>>({})

  useEffect(() => {
    const ids = new Set<string>()
    for (const share of incomingShares) ids.add(share.from_family_id)
    for (const share of outgoingShares) ids.add(share.to_family_id)
    const idsToFetch = [...ids].filter((id) => !(id in familyNames))
    if (idsToFetch.length === 0) return
    let cancelled = false
    Promise.all(idsToFetch.map((id) => getFamilyName(id).then((name) => [id, name] as const))).then(
      (entries) => {
        if (cancelled) return
        setFamilyNames((current) => {
          const next = { ...current }
          for (const [id, name] of entries) next[id] = name
          return next
        })
      }
    )
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [incomingShares, outgoingShares])

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
      reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Noe gikk feil.')
    } finally {
      setBusy(false)
    }
  }

  async function handleRespond(shareId: string, accept: boolean) {
    setBusy(true)
    setError(null)
    try {
      await respondToShare(shareId, accept)
      reloadFamily()
      reload()
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

      <h2 className="section-kicker">Innkommende delinger</h2>
      {myRole !== 'admin' ? (
        <p className="status-message">Kun admin kan godta eller avslå delinger.</p>
      ) : incomingShares.filter((s) => s.status === 'pending').length === 0 ? (
        <p className="status-message">Ingen ventende forespørsler.</p>
      ) : (
        <ul>
          {incomingShares
            .filter((s) => s.status === 'pending')
            .map((share) => (
              <li key={share.id} className="samling-recipe-row">
                <span>
                  {shareTypeLabel(share.share_type)} fra {familyNames[share.from_family_id] ?? '…'}
                </span>
                <button type="button" onClick={() => handleRespond(share.id, true)} disabled={busy}>
                  Godta
                </button>
                <button type="button" onClick={() => handleRespond(share.id, false)} disabled={busy}>
                  Avslå
                </button>
              </li>
            ))}
        </ul>
      )}

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
                  {shareTypeLabel(share.share_type)} til {familyNames[share.to_family_id] ?? '…'} —{' '}
                  {share.status}
                </span>
                <button type="button" onClick={() => handleRevoke(share.id)} disabled={busy}>
                  Trekk tilbake
                </button>
              </li>
            ))}
        </ul>
      )}

      <button type="button" onClick={() => setShowWholeFamilyDialog(true)}>
        Del hele boken med en familie
      </button>

      {showWholeFamilyDialog && (
        <DelTilFamilieDialog shareType="whole_family" onClose={() => setShowWholeFamilyDialog(false)} />
      )}

      <button type="button" className="delete-confirm-button" onClick={handleLeave} disabled={busy}>
        Forlat familien
      </button>
    </div>
  )
}
