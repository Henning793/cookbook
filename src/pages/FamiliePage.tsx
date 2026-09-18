import { useNavigate } from 'react-router-dom'
import { ChevronLeft } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useApp } from '../context/AppContext'
import {
  removeMember,
  leaveFamily,
  getFamilyName,
  createFamily,
  joinFamilyByCode,
} from '../lib/families'
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
    familyLoading,
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

  const [onboardingMode, setOnboardingMode] = useState<'create' | 'join'>('create')
  const [newFamilyName, setNewFamilyName] = useState('')
  const [joinCode, setJoinCode] = useState('')
  const [onboardingBusy, setOnboardingBusy] = useState(false)
  const [onboardingError, setOnboardingError] = useState<string | null>(null)

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

  async function handleCreateFamily(event: React.FormEvent) {
    event.preventDefault()
    setOnboardingError(null)
    setOnboardingBusy(true)
    try {
      await createFamily(newFamilyName.trim())
      // Å opprette en familie absorberer alle våre personlige oppskrifter
      // inn i den (se create_family i migration_family_groups.sql) - må
      // laste oppskriftene på nytt også, ikke bare familien, ellers viser
      // UI-et fortsatt den gamle (personlige) family_id for dem til man
      // laster siden på nytt.
      reloadFamily()
      reload()
    } catch (err) {
      setOnboardingError(err instanceof Error ? err.message : 'Noe gikk feil.')
    } finally {
      setOnboardingBusy(false)
    }
  }

  async function handleJoinFamily(event: React.FormEvent) {
    event.preventDefault()
    setOnboardingError(null)
    setOnboardingBusy(true)
    try {
      await joinFamilyByCode(joinCode.trim())
      // Samme grunn som i handleCreateFamily over.
      reloadFamily()
      reload()
    } catch (err) {
      setOnboardingError(err instanceof Error ? err.message : 'Noe gikk feil.')
    } finally {
      setOnboardingBusy(false)
    }
  }

  if (familyLoading) {
    return (
      <div className="page familie-page">
        <p className="status-message">Laster familie...</p>
      </div>
    )
  }

  if (!family) {
    return (
      <div className="page familie-page">
        <nav className="nav-bar">
          <button type="button" className="nav-link" onClick={() => navigate('/meg')}>
            <ChevronLeft size={14} strokeWidth={2.75} aria-hidden="true" />
            Meg
          </button>
        </nav>

        <h1 className="oppskrift-title">Familie</h1>
        <p className="oppskrift-description">
          Du er ikke medlem av noen familie ennå. Dette er helt valgfritt — du kan legge til og
          bruke egne oppskrifter uten å opprette eller bli med i en familie. Familie trengs først
          når du vil dele oppskrifter med andre.
        </p>

        <div className="form-actions">
          <button type="button" onClick={() => setOnboardingMode('create')} disabled={onboardingMode === 'create'}>
            Opprett familie
          </button>
          <button type="button" onClick={() => setOnboardingMode('join')} disabled={onboardingMode === 'join'}>
            Bli med med kode
          </button>
        </div>

        {onboardingMode === 'create' ? (
          <form onSubmit={handleCreateFamily}>
            <label htmlFor="familie-navn">Familiens navn</label>
            <input
              id="familie-navn"
              type="text"
              required
              value={newFamilyName}
              onChange={(e) => setNewFamilyName(e.target.value)}
            />
            <button type="submit" className="cta-button" disabled={onboardingBusy}>
              {onboardingBusy ? 'Oppretter...' : 'Opprett familie'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleJoinFamily}>
            <label htmlFor="familie-kode">Familiekode</label>
            <input
              id="familie-kode"
              type="text"
              required
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value)}
            />
            <button type="submit" className="cta-button" disabled={onboardingBusy}>
              {onboardingBusy ? 'Blir med...' : 'Bli med i familien'}
            </button>
          </form>
        )}

        {onboardingError && <p className="status-message">{onboardingError}</p>}
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
      // Samme grunn som i handleCreateFamily/handleJoinFamily - hvilke
      // oppskrifter man har tilgang til endrer seg når familiemedlemskapet
      // endrer seg, ikke bare familien selv.
      reloadFamily()
      reload()
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
