export const WELCOME_SEEN_KEY = 'kokeboka:velkomst-sett'
export const NEWS_SEEN_KEY = 'kokeboka:nyheter-sett'

// Sider i velkomsten som er nye. De som allerede har sett velkomsten, får
// bare disse sidene én gang etter at appen er oppdatert.
export const WELCOME_NEWS = ['flere-retter', 'porsjoner']

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

/** Hele velkomsten viser også nyhetene, så de markeres som sett samtidig. */
export function markWelcomeSeen(store: Store, news: readonly string[] = WELCOME_NEWS): void {
  try {
    store.setItem(WELCOME_SEEN_KEY, '1')
  } catch {
    // Se isWelcomeSeen.
  }
  markNewsSeen(store, news)
}

function seenNews(store: Store): string[] {
  const parsed: unknown = JSON.parse(store.getItem(NEWS_SEEN_KEY) ?? '[]')
  return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : []
}

/** Nyhetene brukeren ikke har sett. Tom før hele velkomsten er sett, og når lagringen ikke kan leses. */
export function unseenNews(store: Store, news: readonly string[] = WELCOME_NEWS): string[] {
  try {
    if (store.getItem(WELCOME_SEEN_KEY) === null) return []
    const seen = seenNews(store)
    return news.filter((id) => !seen.includes(id))
  } catch {
    return []
  }
}

export function markNewsSeen(store: Store, news: readonly string[]): void {
  try {
    let seen: string[] = []
    try {
      seen = seenNews(store)
    } catch {
      // Ødelagt verdi skrives over.
    }
    store.setItem(NEWS_SEEN_KEY, JSON.stringify([...new Set([...seen, ...news])]))
  } catch {
    // Se isWelcomeSeen.
  }
}
