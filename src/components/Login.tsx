import { useState, type FormEvent } from 'react'
import { supabase } from '../lib/supabaseClient'

export function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [status, setStatus] = useState<'idle' | 'sending' | 'error'>('idle')
  const [errorMessage, setErrorMessage] = useState('')

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setStatus('sending')
    setErrorMessage('')

    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      setStatus('error')
      setErrorMessage('Feil e-post eller passord')
      return
    }

    setStatus('idle')
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
      <label htmlFor="password">Passord</label>
      <input
        id="password"
        type="password"
        required
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      <button type="submit" disabled={status === 'sending'}>
        {status === 'sending' ? 'Logger inn...' : 'Logg inn'}
      </button>
      {status === 'error' && <p className="error">{errorMessage}</p>}
    </form>
  )
}
