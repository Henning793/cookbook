export const WELCOME_SEEN_KEY = 'kokeboka:velkomst-sett'

// Velkomsten er for nye brukere. Den som opprettet kontoen for lenge siden
// kjenner appen, og finner velkomsten på tips-siden om de vil se den.
const NEW_USER_DAYS = 14

type Store = Pick<Storage, 'getItem' | 'setItem'>

// localStorage kan kaste (f.eks. privat modus eller blokkert lagring). Da
// regnes velkomsten som sett, så den ikke dukker opp ved hver innlasting.
export function isWelcomeSeen(store: Store): boolean {
  try {
    return store.getItem(WELCOME_SEEN_KEY) !== null
  } catch {
    return true
  }
}

export function markWelcomeSeen(store: Store): void {
  try {
    store.setItem(WELCOME_SEEN_KEY, '1')
  } catch {
    // Se isWelcomeSeen.
  }
}

export function isNewUser(createdAt: string | undefined, now: number = Date.now()): boolean {
  if (!createdAt) return false
  const created = Date.parse(createdAt)
  if (Number.isNaN(created)) return false
  return now - created < NEW_USER_DAYS * 24 * 60 * 60 * 1000
}
