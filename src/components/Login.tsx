import { useState, type FormEvent } from 'react'
import { supabase } from '../lib/supabaseClient'

export function Login() {
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')
  const [errorMessage, setErrorMessage] = useState('')

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setStatus('sending')
    setErrorMessage('')

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: window.location.origin,
      },
    })

    if (error) {
      setStatus('error')
      setErrorMessage(error.message)
      return
    }

    setStatus('sent')
  }

  if (status === 'sent') {
    return (
      <p className="login-message">
        Sjekk e-posten din ({email}) for en innloggingslenke.
      </p>
    )
  }

  return (
    <form className="login-form" onSubmit={handleSubmit}>
      <label htmlFor="email">Logg inn for å legge til oppskrifter</label>
      <input
        id="email"
        type="email"
        required
        placeholder="din@epost.no"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <button type="submit" disabled={status === 'sending'}>
        {status === 'sending' ? 'Sender...' : 'Send innloggingslenke'}
      </button>
      {status === 'error' && <p className="error">{errorMessage}</p>}
    </form>
  )
}
