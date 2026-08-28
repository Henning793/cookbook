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

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
