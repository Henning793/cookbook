import type { MenuDay, Recipe } from '../types.ts'
import { allIngredients } from './recipeIngredients.ts'

export interface AggregatedIngredient {
  normalizedName: string
  displayName: string
  unit: string
  amount: number | null
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
// Ingen porsjons-skalering — mengder brukes as-is uansett recipes.servings.
// Ren funksjon (ingen supabase-import) slik at den kan enhetstestes med
// vanlig `node --test`, uten Vite sin import.meta.env.
export function aggregateIngredients(menuDays: MenuDay[], recipes: Recipe[]): AggregatedIngredient[] {
  const recipesById = new Map(recipes.map((r) => [r.id, r]))
  const byKey = new Map<string, AggregatedIngredient>()

  for (const day of menuDays) {
    if (day.entry_type !== 'recipe' || !day.recipe_id) continue
    const recipe = recipesById.get(day.recipe_id)
    if (!recipe) continue

    for (const ingredient of allIngredients(recipe.ingredients)) {
      const normalizedName = normalize(ingredient.name)
      const unit = ingredient.unit
      const key = ingredientKey(normalizedName, unit)
      const existing = byKey.get(key)
      if (existing) {
        if (existing.amount !== null && ingredient.amount !== null) {
          existing.amount += ingredient.amount
        } else if (ingredient.amount !== null) {
          existing.amount = ingredient.amount
        }
      } else {
        byKey.set(key, {
          normalizedName,
          displayName: ingredient.name.trim(),
          unit,
          amount: ingredient.amount,
        })
      }
    }
  }

  return [...byKey.values()]
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
