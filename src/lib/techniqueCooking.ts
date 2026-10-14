// Teknikker åpnet fra et steg i kokemodus vises i et panel over oppskriften,
// så oppskriftens kokemodus aldri forlates. Steget man er på i teknikken
// lagres i kokeøkten (techniqueSteps), per oppskrift og teknikk. Ren modul,
// så den kan testes med node --test.
import type { CookingSession } from './cookingSession.ts'

function techniqueKey(recipeId: string, techniqueId: string): string {
  return `${recipeId}:${techniqueId}`
}

// Steget man stoppet på i teknikken, eller null når kokemodus for teknikken
// ikke er startet (eller den er ferdig).
export function techniqueStep(session: CookingSession | null, recipeId: string, techniqueId: string): number | null {
  const step = session?.techniqueSteps?.[techniqueKey(recipeId, techniqueId)]
  return typeof step === 'number' ? step : null
}

// Kokeøkten med nytt steg i teknikken. null fjerner teknikken (ferdig).
export function withTechniqueStep(
  session: CookingSession,
  recipeId: string,
  techniqueId: string,
  step: number | null
): CookingSession {
  const techniqueSteps = { ...session.techniqueSteps }
  if (step === null) delete techniqueSteps[techniqueKey(recipeId, techniqueId)]
  else techniqueSteps[techniqueKey(recipeId, techniqueId)] = step
  const { techniqueSteps: _old, ...rest } = session
  return Object.keys(techniqueSteps).length > 0 ? { ...rest, techniqueSteps } : rest
}

// Tar med teknikkstegene fra forrige økt når oppskriftens økt lagres på nytt,
// så lenge det er samme koking: samme dag i ukesmenyen, eller samme oppskrift.
// dropRecipeId fjerner teknikkene til en rett som er ferdig.
export function keepTechniqueSteps(
  previous: CookingSession | null,
  next: CookingSession | null,
  dropRecipeId?: string
): CookingSession | null {
  if (!next || !previous?.techniqueSteps) return next
  const same = next.weekday != null ? previous.weekday === next.weekday : previous.recipeId === next.recipeId
  if (!same) return next
  const techniqueSteps = Object.fromEntries(
    Object.entries(previous.techniqueSteps).filter(([key]) => !dropRecipeId || !key.startsWith(`${dropRecipeId}:`))
  )
  return Object.keys(techniqueSteps).length > 0 ? { ...next, techniqueSteps } : next
}

// Klokker startet i teknikken hører til oppskriftens steg, så varselet åpner
// oppskriften der man var. Teksten begynner med teknikkens navn, slik at
// klokken kan skilles fra stegets egen klokke.
export function techniqueTimerText(techniqueTitle: string, stepText: string): string {
  return `${techniqueTitle} · ${stepText}`
}

export function isTechniqueTimerText(text: string, techniqueTitles: string[]): boolean {
  return techniqueTitles.some((title) => text.startsWith(`${title} · `))
}
