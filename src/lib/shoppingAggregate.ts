import type { MenuDay, Recipe } from '../types.ts'
import { allIngredients } from './recipeIngredients.ts'
import { plannedDishes } from './menuDishes.ts'

export { recipeBaseServings } from './menuDishes.ts'

// Hvor mengden kommer fra: én rad per rett i ukesmenyen som bidrar.
// servings er satt bare når retten er ganget opp eller ned.
export interface IngredientSource {
  weekday: number
  recipeTitle: string
  amount: number | null
  servings: number | null
}

export interface AggregatedIngredient {
  normalizedName: string
  displayName: string
  unit: string
  amount: number | null
  // true når minst én av dagene har et annet antall porsjoner enn oppskriften.
  scaled: boolean
  sources: IngredientSource[]
}

// Ting man kjøper hele av rundes opp når mengden er ganget opp (1,5 løk blir 2).
const WHOLE_UNITS = new Set(['', 'stk', 'boks', 'pakke', 'pk', 'fedd', 'bunt', 'pose', 'glass', 'flaske', 'neve'])

function roundScaled(amount: number, unit: string): number {
  if (WHOLE_UNITS.has(unit.trim().toLowerCase())) return Math.ceil(amount - 1e-9)
  return Math.round(amount * 10) / 10
}

export function normalizeItemName(name: string): string {
  return name.trim().toLowerCase()
}

const normalize = normalizeItemName

// JSON.stringify av et par gir en trygg, kollisjonsfri nøkkel uansett hva
// normalizedName/unit inneholder — en manuelt valgt skilletegn-streng (f.eks.
// "|") kunne kollidert hvis et ingrediensnavn tilfeldigvis inneholdt det.
export function ingredientKey(normalizedName: string, unit: string): string {
  return JSON.stringify([normalizedName, unit])
}

// Summerer ingredienser fra alle oppskrift-dager i menuDays (kun
// entry_type 'recipe' — fritekst-dager bidrar ikke). Matcher kun rader med
// samme normalisert navn OG samme enhet. Komponenter flates ut: ingrediensene
// i f.eks. en marinade summeres med løse ingredienser som alle andre.
// Hver rett på dagen (hovedrett og ekstra retter, se menuDishes.ts) ganges
// med antallet den skal lages til / oppskriftens antall før de summeres.
// Ren funksjon (ingen supabase-import) slik at den kan enhetstestes med
// vanlig `node --test`, uten Vite sin import.meta.env.
export function aggregateIngredients(menuDays: MenuDay[], recipes: Recipe[]): AggregatedIngredient[] {
  const byKey = new Map<string, AggregatedIngredient>()

  for (const day of menuDays) {
    for (const dish of plannedDishes(day, recipes)) {
      const scaled = dish.servings !== dish.base
      const factor = scaled ? dish.servings / dish.base : 1

      for (const ingredient of allIngredients(dish.recipe.ingredients)) {
        const normalizedName = normalize(ingredient.name)
        const unit = ingredient.unit
        const key = ingredientKey(normalizedName, unit)
        const amount = ingredient.amount !== null ? ingredient.amount * factor : null
        const source: IngredientSource = {
          weekday: day.weekday,
          recipeTitle: dish.recipe.title,
          amount: amount !== null && scaled ? roundScaled(amount, unit) : amount,
          servings: scaled ? dish.servings : null,
        }
        const existing = byKey.get(key)
        if (existing) {
          if (existing.amount !== null && amount !== null) {
            existing.amount += amount
          } else if (amount !== null) {
            existing.amount = amount
          }
          existing.scaled ||= scaled
          existing.sources.push(source)
        } else {
          byKey.set(key, {
            normalizedName,
            displayName: ingredient.name.trim(),
            unit,
            amount,
            scaled,
            sources: [source],
          })
        }
      }
    }
  }

  const items = [...byKey.values()]
  for (const item of items) {
    if (item.scaled && item.amount !== null) item.amount = roundScaled(item.amount, item.unit)
  }
  return items
}

// Skjuler oppskrift-ingredienser som står i "Alltid hjemme" (eksakt navn,
// trim + små bokstaver, uavhengig av enhet). Egne varer påvirkes ikke.
export function removeAlwaysHome(
  items: AggregatedIngredient[],
  alwaysHomeNames: Set<string>
): AggregatedIngredient[] {
  return items.filter((item) => !alwaysHomeNames.has(item.normalizedName))
}

// Plan for faste kjøp ved ny ukesmeny: varer som mangler i Egne varer
// settes inn, uavkryssede duplikater hoppes over, og avkryssede duplikater
// (ligger igjen som huket av) settes tilbake til uavkrysset i stedet for
// å dobles.
export function planWeeklyAdds<T extends { normalized_name: string }>(
  weekly: T[],
  manual: { id: string; name: string; checked: boolean }[]
): { toInsert: T[]; toUncheckIds: string[] } {
  const toInsert: T[] = []
  const toUncheckIds: string[] = []
  for (const item of weekly) {
    const matches = manual.filter((m) => normalizeItemName(m.name) === item.normalized_name)
    if (matches.length === 0) {
      toInsert.push(item)
    } else if (!matches.some((m) => !m.checked)) {
      toUncheckIds.push(...matches.map((m) => m.id))
    }
  }
  return { toInsert, toUncheckIds }
}

// Skjuler oppskrift-ingredienser som er fjernet med "Fjern avkryssede"
// (samme navn + enhet som en rad med cleared = true).
export function removeCleared(
  items: AggregatedIngredient[],
  clearedKeys: Set<string>
): AggregatedIngredient[] {
  return items.filter((item) => !clearedKeys.has(ingredientKey(item.normalizedName, item.unit)))
}
