import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import { Login } from '../components/Login'
import { acceptShareLink, getShareLinkPreview } from '../lib/shares'
import { forgetLink, linkPath, rememberLink } from '../lib/inviteLinks'
import type { ShareLinkPreview } from '../types'

type State =
  | { kind: 'loading' }
  | { kind: 'invalid' }
  | { kind: 'error' }
  | { kind: 'ready'; preview: ShareLinkPreview }

function describe(preview: ShareLinkPreview): string {
  switch (preview.share_type) {
    case 'recipe':
      return `oppskriften «${preview.title ?? 'uten navn'}»`
    case 'collection':
      return `samlingen «${preview.title ?? 'uten navn'}»`
    default:
      return 'hele kokeboka si'
  }
}

function destination(preview: ShareLinkPreview): string {
  if (preview.share_type === 'recipe' && preview.recipe_id) return `/oppskrift/${preview.recipe_id}`
  if (preview.share_type === 'collection' && preview.collection_id) return `/samlinger/${preview.collection_id}`
  return '/'
}

/** «Godta» en oppskrift, samling eller hel kokebok, åpnet fra en delingslenke. */
export function DelingPage() {
  const { token = '' } = useParams<{ token: string }>()
  const navigate = useNavigate()
  const { session, family, reloadFamily, reload } = useApp()
  const [state, setState] = useState<State>({ kind: 'loading' })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const userId = session?.user.id
  const familyId = family?.id

  // Husk lenken, så brukeren kommer tilbake hit etter innlogging,
  // registrering eller oppretting av familie.
  useEffect(() => {
    rememberLink(linkPath('share', token))
  }, [token])

  // Hentes på nytt når familien endrer seg, slik at has_family stemmer
  // etter at man har opprettet en familie for å ta imot delingen.
  useEffect(() => {
    if (!userId) return
    let active = true
    setState({ kind: 'loading' })
    getShareLinkPreview(token)
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
  }, [token, userId, familyId])

  function leave(to: string) {
    forgetLink()
    navigate(to, { replace: true })
  }

  async function accept(preview: ShareLinkPreview) {
    setBusy(true)
    setError(null)
    try {
      await acceptShareLink(token)
      forgetLink()
      reloadFamily()
      reload()
      navigate(destination(preview), { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Noe gikk feil.')
    } finally {
      setBusy(false)
    }
  }

  if (!session) {
    return (
      <div className="page familie-page">
        <h1 className="oppskrift-title">Noen har delt noe med deg</h1>
        <p className="oppskrift-description">
          Logg inn eller opprett konto for å se hva som er delt og godta det.
        </p>
        <Login />
      </div>
    )
  }

  if (state.kind === 'loading') {
    return (
      <div className="page familie-page">
        <p className="status-message">Laster deling...</p>
      </div>
    )
  }

  if (state.kind !== 'ready') {
    return (
      <div className="page familie-page">
        <h1 className="oppskrift-title">Lenken virker ikke</h1>
        <p className="oppskrift-description">
          {state.kind === 'invalid'
            ? 'Delingslenken er utløpt. Be den som delte med deg om en ny lenke.'
            : 'Kunne ikke hente delingen. Sjekk at du har nett, og åpne lenken på nytt.'}
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
  const sender = preview.shared_by
    ? `${preview.shared_by} (${preview.from_family_name})`
    : preview.from_family_name

  if (preview.own_family) {
    return (
      <div className="page familie-page">
        <h1 className="oppskrift-title">Dette har du allerede</h1>
        <p className="oppskrift-description">
          Lenken gjelder {describe(preview)} fra din egen familie, så du har tilgang fra før.
        </p>
        <div className="familie-footer">
          <button type="button" className="cta-button" onClick={() => leave(destination(preview))}>
            Åpne
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="page familie-page">
      <h1 className="oppskrift-title">
        {preview.share_type === 'whole_family' ? `Kokeboka til ${preview.from_family_name}` : preview.title}
      </h1>
      <p className="oppskrift-description">
        {sender} vil dele {describe(preview)} med deg. Godtar du, dukker det opp i kokeboka til familien din.
      </p>

      {error && <p className="status-message">{error}</p>}

      {preview.has_family ? (
        <div className="familie-footer">
          <button type="button" className="cta-button" onClick={() => accept(preview)} disabled={busy}>
            {busy ? 'Godtar...' : 'Godta'}
          </button>
          <button type="button" className="familie-leave-button" onClick={() => leave('/')} disabled={busy}>
            Ikke nå
          </button>
        </div>
      ) : (
        <>
          <p className="oppskrift-description">
            Delte oppskrifter ligger i en familie. Opprett en familie først (det går fint å være alene i
            den), så kommer du tilbake hit for å godta.
          </p>
          <div className="familie-footer">
            <button type="button" className="cta-button" onClick={() => navigate('/familie')}>
              Opprett familie
            </button>
            <button type="button" className="familie-leave-button" onClick={() => leave('/')}>
              Ikke nå
            </button>
          </div>
        </>
      )}
    </div>
  )
}
