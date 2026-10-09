import { useNavigate } from 'react-router-dom'
import { ChevronLeft } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useApp } from '../context/AppContext'
import {
  removeMember,
  leaveFamily,
  getFamilyName,
  createFamily,
  createFamilyInvite,
} from '../lib/families'
import { revokeShare, respondToShare, createShareLink, removeIncomingShare } from '../lib/shares'
import { getCollection } from '../lib/collections'
import { DelLenkeDialog } from '../components/DelLenkeDialog'
import { pendingLink } from '../lib/inviteLinks'
import { errorMessage } from '../lib/errorMessage'
import { discardPersonalMenuData, hasPersonalMenuData } from '../lib/personalMenuData'
import type { FamilyShare } from '../types'

export function FamiliePage() {
  const navigate = useNavigate()
  const {
    family,
    familyLoading,
    members,
    myRole,
    profiles,
    session,
    recipes,
    incomingShares,
    outgoingShares,
    reloadFamily,
    reload,
  } = useApp()
  const [showInviteDialog, setShowInviteDialog] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showWholeFamilyDialog, setShowWholeFamilyDialog] = useState(false)
  const [familyNames, setFamilyNames] = useState<Record<string, string>>({})
  const [collectionNames, setCollectionNames] = useState<Record<string, string>>({})

  const [newFamilyName, setNewFamilyName] = useState('')
  const [onboardingBusy, setOnboardingBusy] = useState(false)
  const [onboardingError, setOnboardingError] = useState<string | null>(null)
  const [confirmDiscard, setConfirmDiscard] = useState(false)

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

  useEffect(() => {
    const ids = new Set<string>()
    for (const share of [...incomingShares, ...outgoingShares]) {
      if (share.collection_id) ids.add(share.collection_id)
    }
    const idsToFetch = [...ids].filter((id) => !(id in collectionNames))
    if (idsToFetch.length === 0) return
    let cancelled = false
    Promise.all(
      idsToFetch.map((id) =>
        getCollection(id)
          .then((collection) => [id, collection?.name ?? ''] as const)
          .catch(() => [id, ''] as const)
      )
    ).then((entries) => {
      if (cancelled) return
      setCollectionNames((current) => {
        const next = { ...current }
        for (const [id, name] of entries) next[id] = name
        return next
      })
    })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [incomingShares, outgoingShares])

  // Hva en deling gjelder, med navnet på oppskriften eller samlingen når vi kjenner det.
  function shareLabel(share: FamilyShare): string {
    if (share.share_type === 'recipe') {
      const title = recipes.find((r) => r.id === share.recipe_id)?.title
      return title ? `Oppskriften «${title}»` : 'Oppskrift'
    }
    if (share.share_type === 'collection') {
      const name = share.collection_id ? collectionNames[share.collection_id] : ''
      return name ? `Samlingen «${name}»` : 'Samling'
    }
    return 'Hele boken'
  }

  async function runCreateFamily() {
    setOnboardingError(null)
    setOnboardingBusy(true)
    try {
      await createFamily(newFamilyName.trim())
      // Bli medlem av en familie forkaster en eventuell aktiv personlig
      // ukesmeny/handleliste (inkludert egne varer) i stedet for å slå den
      // sammen med familiens - se advarselsdialogen under.
      await discardPersonalMenuData()
      // Å opprette en familie absorberer også alle våre personlige
      // oppskrifter inn i den (se create_family i migration_family_groups.sql)
      // - må laste oppskriftene på nytt også, ikke bare familien, ellers
      // viser UI-et fortsatt den gamle (personlige) family_id for dem til
      // man laster siden på nytt.
      reloadFamily()
      reload()
      // Kom man hit fra en delingslenke for å opprette en familie å ta imot
      // delingen i, går man tilbake dit for å godta.
      const pending = pendingLink()
      if (pending) navigate(pending, { replace: true })
    } catch (err) {
      setOnboardingError(errorMessage(err))
    } finally {
      setOnboardingBusy(false)
      setConfirmDiscard(false)
    }
  }

  async function handleCreateFamily(event: React.FormEvent) {
    event.preventDefault()
    if (await hasPersonalMenuData()) {
      setConfirmDiscard(true)
      return
    }
    await runCreateFamily()
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
        <p className="oppskrift-description">
          Vil du bli med i en familie som finnes fra før? Be et medlem sende deg en invitasjonslenke,
          og åpne den.
        </p>

        <form className="add-recipe-form" onSubmit={handleCreateFamily}>
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

        {onboardingError && <p className="status-message">{onboardingError}</p>}

        {confirmDiscard && (
          <div className="del-dialog-backdrop" onClick={() => !onboardingBusy && setConfirmDiscard(false)}>
            <div className="del-dialog-sheet" onClick={(e) => e.stopPropagation()}>
              <h2 className="del-dialog-title">Forkast personlig ukesmeny?</h2>
              <p className="del-dialog-body">
                Du har en aktiv personlig ukesmeny, handleliste og/eller faste varer. Å bli med i en familie sletter
                disse (inkludert egne varer) — de erstattes av familiens felles ukesmeny og handleliste.
                Dette kan ikke angres.
              </p>
              <div className="del-dialog-actions">
                <button
                  type="button"
                  className="del-dialog-cancel"
                  onClick={() => setConfirmDiscard(false)}
                  disabled={onboardingBusy}
                >
                  Avbryt
                </button>
                <button
                  type="button"
                  className="del-dialog-submit"
                  disabled={onboardingBusy}
                  onClick={runCreateFamily}
                >
                  {onboardingBusy ? 'Fortsetter...' : 'Fortsett og forkast'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }

  function nameFor(userId: string) {
    return profiles.find((p) => p.id === userId)?.display_name ?? 'Ukjent'
  }

  async function handleRemove(userId: string) {
    setBusy(true)
    setError(null)
    try {
      await removeMember(family!.id, userId)
      reloadFamily()
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  async function handleLeave() {
    setBusy(true)
    setError(null)
    try {
      await leaveFamily()
      // Samme grunn som i runCreateFamily - hvilke
      // oppskrifter man har tilgang til endrer seg når familiemedlemskapet
      // endrer seg, ikke bare familien selv.
      reloadFamily()
      reload()
      navigate('/')
    } catch (err) {
      setError(errorMessage(err))
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
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  async function handleRemoveIncoming(shareId: string) {
    setBusy(true)
    setError(null)
    try {
      await removeIncomingShare(shareId)
      reloadFamily()
      reload()
    } catch (err) {
      setError(errorMessage(err))
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
      setError(errorMessage(err))
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

      <div className="familie-section">
        <h2 className="section-kicker">Inviter</h2>
        <p className="oppskrift-description">
          Send en invitasjonslenke til den du vil ha med i familien, for eksempel på SMS.
        </p>
        <button type="button" className="cta-button" onClick={() => setShowInviteDialog(true)}>
          Inviter til {family.name}
        </button>
      </div>

      <div className="familie-section">
        <h2 className="section-kicker">Medlemmer</h2>
        <div>
          {members.map((member) => (
            <div className="familie-member-row" key={member.user_id}>
              <span>
                {nameFor(member.user_id)}{' '}
                {member.role === 'admin' && <span className="familie-member-role">(admin)</span>}
              </span>
              {myRole === 'admin' && member.user_id !== session?.user.id && (
                <button
                  type="button"
                  className="familie-remove-button"
                  onClick={() => handleRemove(member.user_id)}
                  disabled={busy}
                >
                  Fjern
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Delinger godtas nå fra delingslenken. Denne delen vises bare for
          eventuelle eldre forespørsler som ble sendt med familiekode. */}
      {incomingShares.some((s) => s.status === 'pending') && (
      <div className="familie-section">
        <h2 className="section-kicker">Innkommende delinger</h2>
        {myRole !== 'admin' ? (
          <p className="status-message">Kun admin kan godta eller avslå delinger.</p>
        ) : (
          <div>
            {incomingShares
              .filter((s) => s.status === 'pending')
              .map((share) => (
                <div className="familie-share-card" key={share.id}>
                  <span>
                    {shareLabel(share)} fra {familyNames[share.from_family_id] ?? '…'}
                  </span>
                  <div className="familie-share-actions">
                    <button
                      type="button"
                      className="familie-share-accept"
                      onClick={() => handleRespond(share.id, true)}
                      disabled={busy}
                    >
                      Godta
                    </button>
                    <button
                      type="button"
                      className="familie-share-decline"
                      onClick={() => handleRespond(share.id, false)}
                      disabled={busy}
                    >
                      Avslå
                    </button>
                  </div>
                </div>
              ))}
          </div>
        )}
      </div>
      )}

      <div className="familie-section">
        <h2 className="section-kicker">Delt med oss</h2>
        {incomingShares.filter((s) => s.status === 'accepted').length === 0 ? (
          <p className="status-message">Ingen har delt noe med dere ennå.</p>
        ) : (
          <div>
            {incomingShares
              .filter((s) => s.status === 'accepted')
              .map((share) => (
                <div className="familie-share-card" key={share.id}>
                  <span>
                    {shareLabel(share)} fra {familyNames[share.from_family_id] ?? '…'}
                  </span>
                  <div className="familie-share-actions">
                    <button
                      type="button"
                      className="familie-share-revoke"
                      onClick={() => handleRemoveIncoming(share.id)}
                      disabled={busy}
                    >
                      Fjern
                    </button>
                  </div>
                </div>
              ))}
          </div>
        )}
      </div>

      <div className="familie-section">
        <h2 className="section-kicker">Utgående delinger</h2>
        {outgoingShares.filter((s) => s.status === 'accepted' || s.status === 'pending').length === 0 ? (
          <p className="status-message">Ingen aktive delinger.</p>
        ) : (
          <div>
            {outgoingShares
              .filter((s) => s.status === 'accepted' || s.status === 'pending')
              .map((share) => (
                <div className="familie-share-card" key={share.id}>
                  <span>
                    {shareLabel(share)} til {familyNames[share.to_family_id] ?? '…'} —{' '}
                    {share.status === 'accepted' ? 'godtatt' : 'venter'}
                  </span>
                  <div className="familie-share-actions">
                    <button
                      type="button"
                      className="familie-share-revoke"
                      onClick={() => handleRevoke(share.id)}
                      disabled={busy}
                    >
                      Trekk tilbake
                    </button>
                  </div>
                </div>
              ))}
          </div>
        )}
      </div>

      {showInviteDialog && (
        <DelLenkeDialog
          kind="invite"
          title={`Inviter til ${family.name}`}
          body="Alle som har lenken kan bli med i familien."
          shareText={`Bli med i ${family.name} i Kokeboka:`}
          createToken={createFamilyInvite}
          onClose={() => setShowInviteDialog(false)}
        />
      )}

      {showWholeFamilyDialog && (
        <DelLenkeDialog
          kind="share"
          title="Del hele boken"
          body="Den som åpner lenken og godtar, får se alle oppskriftene og samlingene til familien."
          shareText={`${family.name} vil dele kokeboka si med deg:`}
          createToken={() => createShareLink('whole_family', null, null)}
          onClose={() => setShowWholeFamilyDialog(false)}
        />
      )}

      <div className="familie-footer">
        <button type="button" className="cta-button" onClick={() => setShowWholeFamilyDialog(true)}>
          Del hele boken med en familie
        </button>
        <button type="button" className="familie-leave-button" onClick={handleLeave} disabled={busy}>
          Forlat familien
        </button>
      </div>
    </div>
  )
}
