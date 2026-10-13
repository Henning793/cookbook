// Koking fra dagssiden i ukesmenyen, når dagen har flere oppskrifter. Hver
// rett husker sitt eget steg, så man kan hoppe mellom rettene i kokemodus uten
// å miste plassen. Fremgangen ligger i kokeøkten (lib/cookingSession) på
// telefonen, ikke i databasen. Ren modul, så den kan testes med node --test.
import type { CookingSession } from './cookingSession.ts'
import { isRunning, remainingMs, type CookingTimer } from './cookingTimers.ts'
import { formatClock } from './stepTimer.ts'

export const WEEKDAY_NAMES = ['Mandag', 'Tirsdag', 'Onsdag', 'Torsdag', 'Fredag', 'Lørdag', 'Søndag']

export function dayPath(weekday: number): string {
  return `/ukesmeny/dag/${weekday}`
}

// Kokemodus for en rett på dagen. Antallet tas alltid med, siden hver rett
// på dagen kan lages til et annet antall.
export function dayKokemodusPath(recipeId: string, weekday: number, servings: number | null): string {
  return `/oppskrift/${recipeId}/kok?dag=${weekday}` + (servings != null ? `&porsjoner=${servings}` : '')
}

// ?dag=N fra adressen. Ugyldig eller manglende verdi gir null (vanlig kokemodus).
export function parseWeekdayParam(value: string | null): number | null {
  if (value == null || value.trim() === '') return null
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed >= 0 && parsed <= 6 ? parsed : null
}

function sameDay(session: CookingSession | null, weekday: number): session is CookingSession {
  return session != null && session.weekday === weekday
}

export type DishProgress = { kind: 'step'; stepIndex: number } | { kind: 'done' } | null

// Hvor langt man er kommet i en rett på dagen. null = ikke startet.
export function dishProgress(session: CookingSession | null, weekday: number, recipeId: string): DishProgress {
  if (!sameDay(session, weekday)) return null
  if (session.doneIds?.includes(recipeId)) return { kind: 'done' }
  const step = session.dishSteps?.[recipeId]
  return typeof step === 'number' ? { kind: 'step', stepIndex: step } : null
}

// Steget kokemodus skal starte på for en rett på dagen.
export function dayStartStep(session: CookingSession | null, weekday: number, recipeId: string): number {
  const progress = dishProgress(session, weekday, recipeId)
  return progress?.kind === 'step' ? progress.stepIndex : 0
}

// Kokeøkten etter at man har kommet til et steg i en rett på dagen. En økt
// for en annen dag eller en vanlig oppskrift erstattes.
export function withDayStep(
  session: CookingSession | null,
  weekday: number,
  recipeId: string,
  stepIndex: number,
  servings: number | null
): CookingSession {
  const previous = sameDay(session, weekday) ? session : null
  return {
    recipeId,
    stepIndex,
    ...(servings != null ? { servings } : {}),
    weekday,
    dishSteps: { ...previous?.dishSteps, [recipeId]: stepIndex },
    doneIds: (previous?.doneIds ?? []).filter((id) => id !== recipeId),
  }
}

// Kokeøkten etter «Ferdig» på en rett. Er andre retter fortsatt i gang, blir
// den sist brukte av dem «Sist brukt» på forsiden. Ellers er økten over.
export function finishDayDish(session: CookingSession | null, weekday: number, recipeId: string): CookingSession | null {
  if (!sameDay(session, weekday)) return null
  const dishSteps = { ...session.dishSteps }
  delete dishSteps[recipeId]
  const remaining = Object.keys(dishSteps)
  if (remaining.length === 0) return null
  const next = remaining[remaining.length - 1]
  return {
    recipeId: next,
    stepIndex: dishSteps[next],
    weekday,
    dishSteps,
    doneIds: [...(session.doneIds ?? []).filter((id) => id !== recipeId), recipeId],
  }
}

// Fanen dagssiden skal vise: den i adressen, ellers retten man sist kokte på
// denne dagen, ellers den første.
export function selectedDish(
  dishIds: string[],
  fromUrl: string | null,
  session: CookingSession | null,
  weekday: number
): string | null {
  if (fromUrl && dishIds.includes(fromUrl)) return fromUrl
  if (sameDay(session, weekday) && dishIds.includes(session.recipeId)) return session.recipeId
  return dishIds[0] ?? null
}

// Nedtellingen som vises på en rett: «Ringer» hvis en klokke i retten ringer,
// ellers tiden igjen på den som går ut først. null når ingen går.
export function dishTimerLabel(timers: CookingTimer[], recipeId: string, now: number): string | null {
  const own = timers.filter((t) => t.recipeId === recipeId)
  if (own.some((t) => t.ringing)) return 'Ringer'
  const running = own.filter(isRunning).map((t) => remainingMs(t, now))
  return running.length > 0 ? formatClock(Math.min(...running)) : null
}
