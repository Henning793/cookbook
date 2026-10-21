// Navnene på service workerens mellomlagre for Supabase (se vite.config.ts).
export const SUPABASE_API_CACHE = 'supabase-api'
export const SUPABASE_IMAGE_CACHE = 'supabase-images'
// Før API og bilder fikk hvert sitt lager lå alt i dette.
const LEGACY_CACHE = 'supabase-cache'

function deleteCaches(names: string[]) {
  if (typeof caches === 'undefined') return
  for (const name of names) caches.delete(name).catch(() => {})
}

// Tømmer lagrede svar fra databasen (meny, handleliste, familie) ved
// utlogging, så neste som logger inn på samme telefon ikke kan få dem som
// reservesvar uten nett. Bildene er offentlige og får ligge.
export function clearSupabaseCache() {
  deleteCaches([SUPABASE_API_CACHE, LEGACY_CACHE])
}

export function removeLegacyCache() {
  deleteCaches([LEGACY_CACHE])
}
