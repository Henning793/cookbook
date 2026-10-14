// Kokeøkten bak "Sist brukt" på forsiden. Ren modul (ingen supabase-/Vite-import)
// slik at den kan testes med node --test.

export interface CookingSession {
  recipeId: string
  stepIndex: number
  // Valgt antall porsjoner fra oppskriftssiden, slik at "Fortsett" på
  // forsiden viser samme skalerte mengder.
  servings?: number
  // Satt når man koker fra dagssiden i ukesmenyen (se lib/dayCooking).
  // weekday er dagen (0 = mandag), dishSteps steget man stoppet på i hver
  // rett, og doneIds rettene man har trykket «Ferdig» på.
  weekday?: number
  dishSteps?: Record<string, number>
  doneIds?: string[]
  // Steget man er på i teknikker åpnet i panelet i kokemodus (se
  // lib/techniqueCooking). Nøkkelen er «oppskrift:teknikk».
  techniqueSteps?: Record<string, number>
  // Når økten sist ble lagret (ms siden 1970). Mangler i økter lagret før
  // feltet fantes.
  savedAt?: number
}

// «Fortsett» på forsiden vises bare så lenge økten er fersk, så en oppskrift
// man aldri lagde ferdig ikke blir liggende der i dagevis.
export const COOKING_SESSION_MAX_AGE_MS = 12 * 60 * 60 * 1000

export function isRecentCookingSession(session: CookingSession | null, now: number): session is CookingSession {
  return session?.savedAt != null && now - session.savedAt <= COOKING_SESSION_MAX_AGE_MS
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
