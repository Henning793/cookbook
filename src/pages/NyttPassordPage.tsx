import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import { supabase } from '../lib/supabaseClient'
import { PasswordField } from '../components/PasswordField'

/**
 * «Lag nytt passord», åpnet fra lenken i e-posten fra «Glemt passord?».
 * Supabase logger brukeren inn fra lenken (adressen får en
 * gjenopprettingsøkt), så her trenger vi bare å sette det nye passordet.
 * Uten økt er lenken brukt opp, utløpt eller åpnet i en annen nettleser.
 */
export function NyttPassordPage() {
  const navigate = useNavigate()
  const { session, sessionLoading } = useApp()
  const [password, setPassword] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')
  const [status, setStatus] = useState<'idle' | 'sending' | 'error'>('idle')
  const [errorMessage, setErrorMessage] = useState('')

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setErrorMessage('')

    if (password !== passwordConfirm) {
      setStatus('error')
      setErrorMessage('Passordene er ikke like. Skriv det samme passordet i begge feltene.')
      return
    }

    setStatus('sending')

    const { error } = await supabase.auth.updateUser({ password })

    if (error) {
      setStatus('error')
      setErrorMessage(
        error.code === 'same_password'
          ? 'Det nye passordet må være forskjellig fra det gamle.'
          : 'Kunne ikke lagre passordet: ' + error.message
      )
      return
    }

    navigate('/', { replace: true })
  }

  if (sessionLoading) return null

  return (
    <div className="page landing-page">
      <div className="landing-hero">
        <img className="landing-icon" src="/icons/icon-192.png" alt="" width={72} height={72} />
        <h1 className="hjem-title">Nytt passord</h1>
      </div>

      {session ? (
        <form className="login-form" onSubmit={handleSubmit}>
          <label htmlFor="new-password">Nytt passord</label>
          <PasswordField
            id="new-password"
            required
            minLength={6}
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <label htmlFor="new-password-confirm">Gjenta passord</label>
          <PasswordField
            id="new-password-confirm"
            required
            minLength={6}
            autoComplete="new-password"
            value={passwordConfirm}
            onChange={(e) => setPasswordConfirm(e.target.value)}
          />
          <button type="submit" disabled={status === 'sending'}>
            {status === 'sending' ? 'Lagrer...' : 'Lagre nytt passord'}
          </button>
          {status === 'error' && <p className="error">{errorMessage}</p>}
        </form>
      ) : (
        <div className="login-form">
          <p className="login-message">
            Lenken er utløpt eller allerede brukt. Be om en ny lenke under «Glemt passord?» på
            innloggingssiden.
          </p>
          <button type="button" className="nav-link" onClick={() => navigate('/', { replace: true })}>
            Til innlogging
          </button>
        </div>
      )}
    </div>
  )
}
