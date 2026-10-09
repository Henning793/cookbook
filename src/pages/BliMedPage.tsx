import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import { Login } from '../components/Login'
import { getFamilyInvitePreview, joinFamilyByInvite } from '../lib/families'
import { errorMessage } from '../lib/errorMessage'
import { forgetLink, linkPath, rememberLink } from '../lib/inviteLinks'
import { discardPersonalMenuData, hasPersonalMenuData } from '../lib/personalMenuData'
import type { FamilyInvitePreview } from '../types'

type State =
  | { kind: 'loading' }
  | { kind: 'invalid' }
  | { kind: 'error' }
  | { kind: 'ready'; preview: FamilyInvitePreview }

/** «Bli med i <familienavn>», åpnet fra en invitasjonslenke. */
export function BliMedPage() {
  const { token = '' } = useParams<{ token: string }>()
  const navigate = useNavigate()
  const { session, reloadFamily, reload } = useApp()
  const [state, setState] = useState<State>({ kind: 'loading' })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmDiscard, setConfirmDiscard] = useState(false)

  const userId = session?.user.id

  // Husk lenken, så brukeren kommer tilbake hit etter registrering eller innlogging.
  useEffect(() => {
    rememberLink(linkPath('invite', token))
  }, [token])

  useEffect(() => {
    if (!userId) return
    let active = true
    setState({ kind: 'loading' })
    getFamilyInvitePreview(token)
      .then((preview) => {
        if (!active) return
        if (preview) {
          setState({ kind: 'ready', preview })
        } else {
          // Ugyldig lenke: ikke send brukeren hit igjen senere.
          forgetLink()
          setState({ kind: 'invalid' })
        }
      })
      .catch(() => {
        if (active) setState({ kind: 'error' })
      })
    return () => {
      active = false
    }
  }, [token, userId])

  function leave(to: string) {
    forgetLink()
    navigate(to, { replace: true })
  }

  async function join() {
    setBusy(true)
    setError(null)
    try {
      await joinFamilyByInvite(token)
      await discardPersonalMenuData()
      forgetLink()
      reloadFamily()
      reload()
      navigate('/', { replace: true })
    } catch (err) {
      setError(errorMessage(err))
      setConfirmDiscard(false)
    } finally {
      setBusy(false)
    }
  }

  async function handleJoinClick() {
    setError(null)
    try {
      if (await hasPersonalMenuData()) {
        setConfirmDiscard(true)
        return
      }
    } catch {
      // Kunne ikke sjekke - join() sletter uansett bare det som finnes.
    }
    await join()
  }

  if (!session) {
    return (
      <div className="page familie-page">
        <h1 className="oppskrift-title">Du er invitert til en gruppe</h1>
        <p className="oppskrift-description">
          Logg inn eller opprett konto, så kan du bli med med ett trykk.
        </p>
        <Login />
      </div>
    )
  }

  if (state.kind === 'loading') {
    return (
      <div className="page familie-page">
        <p className="status-message">Laster invitasjon...</p>
      </div>
    )
  }

  if (state.kind !== 'ready') {
    return (
      <div className="page familie-page">
        <h1 className="oppskrift-title">Lenken virker ikke</h1>
        <p className="oppskrift-description">
          {state.kind === 'invalid'
            ? 'Invitasjonslenken er utløpt. Be den som inviterte deg om en ny lenke.'
            : 'Kunne ikke hente invitasjonen. Sjekk at du har nett, og åpne lenken på nytt.'}
        </p>
        <div className="familie-footer">
          <button type="button" className="cta-button" onClick={() => leave('/')}>
            Til kokeboka
          </button>
        </div>
      </div>
    )
  }

  const { preview } = state

  if (preview.already_member) {
    return (
      <div className="page familie-page">
        <h1 className="oppskrift-title">Du er allerede med i {preview.family_name}</h1>
        <div className="familie-footer">
          <button type="button" className="cta-button" onClick={() => leave('/')}>
            Til kokeboka
          </button>
        </div>
      </div>
    )
  }

  if (preview.current_family_name) {
    return (
      <div className="page familie-page">
        <h1 className="oppskrift-title">Bli med i {preview.family_name}</h1>
        <p className="oppskrift-description">
          Du er allerede medlem av {preview.current_family_name}, og man kan bare være med i én gruppe om
          gangen. Forlat {preview.current_family_name} først, og åpne invitasjonslenken på nytt.
        </p>
        <div className="familie-footer">
          <button type="button" className="cta-button" onClick={() => navigate('/familie')}>
            Gå til gruppen min
          </button>
          <button type="button" className="familie-leave-button" onClick={() => leave('/')}>
            Ikke nå
          </button>
        </div>
      </div>
    )
  }

  const others = preview.member_count === 1 ? '1 er med fra før.' : `${preview.member_count} er med fra før.`

  return (
    <div className="page familie-page">
      <h1 className="oppskrift-title">Bli med i {preview.family_name}</h1>
      <p className="oppskrift-description">
        {preview.invited_by ? `${preview.invited_by} har invitert deg. ` : ''}
        {others} I en gruppe deler dere oppskrifter, ukesmeny og handleliste.
      </p>

      {error && <p className="status-message">{error}</p>}

      <div className="familie-footer">
        <button type="button" className="cta-button" onClick={handleJoinClick} disabled={busy}>
          {busy ? 'Blir med...' : `Bli med i ${preview.family_name}`}
        </button>
        <button type="button" className="familie-leave-button" onClick={() => leave('/')} disabled={busy}>
          Ikke nå
        </button>
      </div>

      {confirmDiscard && (
        <div className="del-dialog-backdrop" onClick={() => !busy && setConfirmDiscard(false)}>
          <div className="del-dialog-sheet" onClick={(e) => e.stopPropagation()}>
            <h2 className="del-dialog-title">Forkast personlig ukesmeny?</h2>
            <p className="del-dialog-body">
              Du har en aktiv personlig ukesmeny, handleliste og/eller faste varer. Å bli med i en gruppe sletter
              disse (inkludert egne varer) — de erstattes av gruppens felles ukesmeny og handleliste.
              Dette kan ikke angres.
            </p>
            <div className="del-dialog-actions">
              <button
                type="button"
                className="del-dialog-cancel"
                onClick={() => setConfirmDiscard(false)}
                disabled={busy}
              >
                Avbryt
              </button>
              <button type="button" className="del-dialog-submit" disabled={busy} onClick={join}>
                {busy ? 'Fortsetter...' : 'Fortsett og forkast'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
