// Kokeøkten bak "Sist brukt" på forsiden. Ren modul (ingen supabase-/Vite-import)
// slik at den kan testes med node --test.

export interface CookingSession {
  recipeId: string
  stepIndex: number
  // Valgt antall porsjoner fra oppskriftssiden, slik at "Fortsett" på
  // forsiden viser samme skalerte mengder.
  servings?: number
}

type Store = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

const BASE_KEY = 'kokeboka.cooking'

// Kokeøkten lagres per bruker. Ellers ville den som logger inn i samme
// nettleser etterpå fått den forrige brukerens "Sist brukt" på forsiden.
// Uten innlogging brukes nøkkelen uten bruker-id.
export function cookingSessionKey(userId: string | null): string {
  return userId ? `${BASE_KEY}:${userId}` : BASE_KEY
}

export function readCookingSession(store: Store, userId: string | null): CookingSession | null {
  try {
    const raw = store.getItem(cookingSessionKey(userId))
    const parsed: unknown = raw ? JSON.parse(raw) : null
    if (!parsed || typeof parsed !== 'object') return null
    const { recipeId, stepIndex } = parsed as Partial<CookingSession>
    if (typeof recipeId !== 'string' || typeof stepIndex !== 'number') return null
    return parsed as CookingSession
  } catch {
    return null
  }
}

export function writeCookingSession(store: Store, userId: string | null, session: CookingSession | null): void {
  try {
    if (session) {
      store.setItem(cookingSessionKey(userId), JSON.stringify(session))
    } else {
      store.removeItem(cookingSessionKey(userId))
    }
  } catch {
    // localStorage utilgjengelig (privat modus, e.l.) - kokeøkten lever da
    // bare i minnet for denne siden, som er en akseptabel avveining.
  }
}
