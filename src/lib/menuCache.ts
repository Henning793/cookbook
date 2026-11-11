import type { MenuDay } from '../types'

// Sist hentede dager per uke, så ukesmenyen og forsiden kan vise menyen med
// en gang og hente på nytt i bakgrunnen. Ligger bare i minnet og tømmes når
// en annen bruker logger inn (se AppContext), så ingen ser forrige brukers meny.
const cache = new Map<string, MenuDay[]>()

function key(familyId: string | null, week: string): string {
  return `${familyId ?? 'meg'}:${week}`
}

export function cachedMenuDays(familyId: string | null, week: string): MenuDay[] | undefined {
  return cache.get(key(familyId, week))
}

export function rememberMenuDays(familyId: string | null, week: string, days: MenuDay[]): void {
  cache.set(key(familyId, week), days)
}

export function clearMenuCache(): void {
  cache.clear()
  shownWeek = null
}

// Uken man sist så på i ukesmenyen, så «Legg i ukesmenyen» fra en samling
// åpner på samme uke. Bare i minnet.
let shownWeek: string | null = null

export function rememberShownWeek(week: string): void {
  shownWeek = week
}

export function lastShownWeek(): string | null {
  return shownWeek
}
