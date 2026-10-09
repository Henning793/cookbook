/**
 * Feilmeldingen fra en kastet feil. Supabase-feil er ikke alltid
 * Error-objekter, men har likevel en lesbar `message` (f.eks. teksten fra
 * `raise exception` i en databasefunksjon).
 */
export function errorMessage(err: unknown, fallback = 'Noe gikk feil.'): string {
  if (typeof err === 'object' && err !== null && 'message' in err) {
    const message = (err as { message: unknown }).message
    if (typeof message === 'string' && message.trim()) return message
  }
  return fallback
}
