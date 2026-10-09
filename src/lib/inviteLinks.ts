// Lenker man sender til andre (f.eks. på SMS): invitasjon til familien og
// deling av oppskrift, samling eller hele boken.

export type LinkKind = 'invite' | 'share'

const PREFIX: Record<LinkKind, string> = {
  invite: '/bli-med/',
  share: '/del/',
}

const KEY = 'kokeboka.pendingLink'

export function linkPath(kind: LinkKind, token: string): string {
  return `${PREFIX[kind]}${token}`
}

export function linkUrl(kind: LinkKind, token: string, origin: string = window.location.origin): string {
  return `${origin}${linkPath(kind, token)}`
}

/** Bare stier til invitasjons- og delingssidene huskes og følges. */
export function isLinkPath(path: unknown): path is string {
  return typeof path === 'string' && /^\/(bli-med|del)\/[A-Za-z0-9_-]{8,}$/.test(path)
}

// Lenken huskes gjennom innlogging og registrering (også når e-post må
// bekreftes i en ny fane), og mens man oppretter en familie for å ta imot
// en deling.
export function rememberLink(path: string) {
  if (!isLinkPath(path)) return
  try {
    localStorage.setItem(KEY, path)
  } catch {
    // Uten lager må brukeren åpne lenken på nytt etter innlogging.
  }
}

export function pendingLink(): string | null {
  try {
    const path = localStorage.getItem(KEY)
    return isLinkPath(path) ? path : null
  } catch {
    return null
  }
}

export function forgetLink() {
  try {
    localStorage.removeItem(KEY)
  } catch {
    // Ingenting å gjøre.
  }
}
