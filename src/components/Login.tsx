import { useState, type FormEvent } from 'react'
import { supabase } from '../lib/supabaseClient'
import { PasswordField } from './PasswordField'
import { TurnstileWidget } from './TurnstileWidget'

type Mode = 'login' | 'signup'

export function Login() {
  const [mode, setMode] = useState<Mode>('login')

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [captchaToken, setCaptchaToken] = useState<string | null>(null)
  const [status, setStatus] = useState<'idle' | 'sending' | 'error'>('idle')
  const [errorMessage, setErrorMessage] = useState('')

  function switchMode(next: Mode) {
    setMode(next)
    setPasswordConfirm('')
    setStatus('idle')
    setErrorMessage('')
    setCaptchaToken(null)
  }

  async function handleLogin(e: FormEvent) {
    e.preventDefault()
    setErrorMessage('')

    // Supabase sin CAPTCHA-beskyttelse gjelder innlogging også, ikke bare
    // registrering - se README. Uten en gyldig captchaToken her avviser
    // Supabase Auth ethvert innloggingsforsøk med en feilmelding fra
    // serveren, uansett om e-post/passord er riktig.
    if (!captchaToken) {
      setStatus('error')
      setErrorMessage('Bekreft at du ikke er en robot.')
      return
    }

    setStatus('sending')

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
      options: { captchaToken },
    })

    if (error) {
      setStatus('error')
      setErrorMessage('Feil e-post eller passord')
      return
    }

    setStatus('idle')
  }

  async function handleSignup(e: FormEvent) {
    e.preventDefault()
    setErrorMessage('')

    if (password !== passwordConfirm) {
      setStatus('error')
      setErrorMessage('Passordene er ikke like. Skriv det samme passordet i begge feltene.')
      return
    }

    if (!captchaToken) {
      setStatus('error')
      setErrorMessage('Bekreft at du ikke er en robot.')
      return
    }

    setStatus('sending')

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { captchaToken },
    })

    if (error) {
      setStatus('error')
      setErrorMessage(error.message)
      return
    }

    if (data.user) {
      const { error: profileError } = await supabase
        .from('profiles')
        .insert({ id: data.user.id, display_name: displayName.trim() || email })
      if (profileError) {
        setStatus('error')
        setErrorMessage(
          'Kontoen ble opprettet, men visningsnavnet kunne ikke lagres: ' + profileError.message
        )
        return
      }
    }

    if (!data.session) {
      // E-postbekreftelse er skrudd på i Supabase Auth-innstillingene, i
      // strid med det appen forventer (se README) - brukeren må bekrefte
      // e-posten før de kan logge inn.
      setStatus('idle')
      setErrorMessage('Konto opprettet. Sjekk e-posten din for å bekrefte kontoen før du logger inn.')
      return
    }

    setStatus('idle')
  }

  if (mode === 'signup') {
    return (
      <form className="login-form" onSubmit={handleSignup}>
        <label htmlFor="signup-name">Navn</label>
        <input
          id="signup-name"
          type="text"
          required
          placeholder="Kari"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
        />
        <label htmlFor="signup-email">E-post</label>
        <input
          id="signup-email"
          type="email"
          required
          placeholder="din@epost.no"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <label htmlFor="signup-password">Passord</label>
        <PasswordField
          id="signup-password"
          required
          minLength={6}
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <label htmlFor="signup-password-confirm">Gjenta passord</label>
        <PasswordField
          id="signup-password-confirm"
          required
          minLength={6}
          autoComplete="new-password"
          value={passwordConfirm}
          onChange={(e) => setPasswordConfirm(e.target.value)}
        />
        <TurnstileWidget onVerify={setCaptchaToken} onExpire={() => setCaptchaToken(null)} />
        <button type="submit" disabled={status === 'sending'}>
          {status === 'sending' ? 'Oppretter konto...' : 'Opprett konto'}
        </button>
        {status === 'error' && <p className="error">{errorMessage}</p>}
        <button type="button" className="nav-link" onClick={() => switchMode('login')}>
          Har du allerede en konto? Logg inn
        </button>
      </form>
    )
  }

  return (
    <form className="login-form" onSubmit={handleLogin}>
      <label htmlFor="email">Logg inn for å legge til oppskrifter</label>
      <input
        id="email"
        type="email"
        required
        placeholder="din@epost.no"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <label htmlFor="password">Passord</label>
      <PasswordField
        id="password"
        required
        autoComplete="current-password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      <TurnstileWidget onVerify={setCaptchaToken} onExpire={() => setCaptchaToken(null)} />
      <button type="submit" disabled={status === 'sending'}>
        {status === 'sending' ? 'Logger inn...' : 'Logg inn'}
      </button>
      {status === 'error' && <p className="error">{errorMessage}</p>}
      <button type="button" className="nav-link" onClick={() => switchMode('signup')}>
        Ny bruker? Opprett konto
      </button>
    </form>
  )
}
