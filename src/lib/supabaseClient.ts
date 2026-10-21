import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  // Makes the missing-config case obvious in the browser console instead of
  // a cryptic network error the first time someone loads the app.
  console.warn(
    'Mangler VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY. Se README.md for oppsett.'
  )
}

// Lenken i e-posten fra «Glemt passord?» åpner appen med type=recovery i
// adressen. Supabase fjerner den når innloggingen fra lenken er lest, så
// den må fanges opp her, før klienten opprettes. Da kan appen sende
// brukeren til siden for nytt passord også når Supabase har sendt lenken
// til forsiden (Site URL) i stedet for til /nytt-passord.
let recoveryLinkPending =
  typeof window !== 'undefined' && window.location.hash.includes('type=recovery')

export function isRecoveryLinkPending(): boolean {
  return recoveryLinkPending
}

export function clearRecoveryLink() {
  recoveryLinkPending = false
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Den innloggede brukerens id, lest fra innloggingen som er lagret i appen.
// getUser() ville spurt innloggingsserveren på nytt hver gang og lagt et
// ekstra nettverkskall foran spørringen. Det er trygt å bruke den lagrede:
// tilgangsreglene i databasen sjekker uansett auth.uid() fra billetten, så
// id-en her er bare et filter.
export async function signedInUserId(): Promise<string | null> {
  const { data } = await supabase.auth.getSession()
  return data.session?.user.id ?? null
}
