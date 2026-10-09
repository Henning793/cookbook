import type { IngredientItem, RecipeComponent, RecipeIngredients } from '../types.ts'
import { parseStep } from './recipeIngredients.ts'
import { guessStepSeconds, withTimerOverride } from './stepTimer.ts'
import { UNITS } from './units.ts'

// Ren modul (ingen supabase-/Vite-import) slik at den kan enhetstestes med
// vanlig `node --test`.
//
// Gjør svaret fra edge-funksjonen recipe-from-image om til verdiene
// oppskriftsskjemaet bruker. Svaret kommer fra en språkmodell, så alt
// ryddes og sjekkes her i stedet for å stoles på.

export interface ScannedFormValues {
  title: string
  description: string | null
  ingredients: RecipeIngredients
  steps: string[]
  servings: number | null
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : ''
}

// "SS", "stk." og "Dl" blir enhetene skjemaet kjenner; andre beholdes som skrevet.
function toUnit(value: unknown): string {
  const unit = text(value)
  const known = unit.toLowerCase().replace(/\.$/, '')
  return (UNITS as readonly string[]).includes(known) ? known : unit
}

function toItems(raw: unknown): IngredientItem[] {
  if (!Array.isArray(raw)) return []
  return raw.filter(isRecord).flatMap((entry) => {
    const name = text(entry.name)
    if (!name) return []
    const amount = typeof entry.amount === 'number' && Number.isFinite(entry.amount) && entry.amount > 0 ? entry.amount : null
    return [{ amount, unit: toUnit(entry.unit), name }]
  })
}

// Fjerner "@" foran ord som ikke er navnet på en komponent, så de ikke blir
// stående som rusk i stegteksten.
function dropUnknownLinks(step: string, ingredients: RecipeIngredients): string {
  return parseStep(step, ingredients)
    .map((segment) => (segment.component ? `@${segment.text}` : segment.text.replace(/(^|[^\p{L}\p{N}])@(?=\S)/gu, '$1')))
    .join('')
}

export function scannedToFormValues(raw: unknown): ScannedFormValues {
  const recipe = isRecord(raw) ? raw : {}

  const loose = toItems(recipe.loose_ingredients)
  const components: RecipeComponent[] = []
  for (const entry of Array.isArray(recipe.components) ? recipe.components.filter(isRecord) : []) {
    const name = text(entry.name).replace(/:$/, '').replace(/^@+/, '').trim()
    const items = toItems(entry.ingredients)
    if (items.length === 0) continue
    // En gruppe uten navn kan ikke kobles til; ingrediensene blir løse.
    if (name) components.push({ name, ingredients: items })
    else loose.push(...items)
  }
  const ingredients = { loose, components }

  const steps = (Array.isArray(recipe.steps) ? recipe.steps : []).flatMap((entry) => {
    const record: Record<string, unknown> = isRecord(entry) ? entry : { text: entry }
    const stepText = dropUnknownLinks(text(record.text).replace(/^\d+\s*[.):]\s*/, ''), ingredients)
    if (!stepText) return []
    // Tiden lagres bare når den avviker fra det appen selv gjetter fra teksten.
    const minutes = record.timer_minutes
    if (typeof minutes === 'number' && Number.isFinite(minutes) && minutes > 0) {
      const guessed = guessStepSeconds(stepText)
      if (guessed === null || Math.abs(guessed - minutes * 60) >= 30) return [withTimerOverride(stepText, minutes)]
    }
    return [stepText]
  })

  const servings = recipe.servings
  return {
    title: text(recipe.title),
    description: text(recipe.description) || null,
    ingredients,
    steps,
    servings: typeof servings === 'number' && Number.isInteger(servings) && servings > 0 ? servings : null,
  }
}
