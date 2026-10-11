export const WELCOME_SEEN_KEY = 'kokeboka:velkomst-sett'

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
