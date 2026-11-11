// Legge en oppskrift i ukesmenyen rett fra en samling (dra raden mot venstre
// eller hold inne). Retten legges til dagen: er dagen tom, blir den
// hovedrett; har dagen mat fra før, blir den en ekstra rett. Ren logikk uten
// supabase-import, så den kan testes med node --test.
import type { MenuDay, Recipe } from '../types.ts'
import { draftDishes, recipeBaseServings, sharedServings, toMenuDayDishes } from './menuDishes.ts'
import type { MenuDayDishes } from './menuDishes.ts'

// Om oppskriften alt står på dagen.
export function dayHasRecipe(day: MenuDay | undefined, recipeId: string): boolean {
  return draftDishes(day).some((d) => 'recipeId' in d && d.recipeId === recipeId)
}

// Dagen med oppskriften lagt til sist. Den nye retten følger dagens antall;
// er det ingen oppskrift på dagen fra før, gjelder oppskriftens eget antall.
export function withRecipeAdded(day: MenuDay | undefined, recipe: Recipe, recipes: Recipe[]): MenuDayDishes {
  const drafts = [...draftDishes(day), { recipeId: recipe.id, servings: null }]
  const shared = (day ? sharedServings(day, recipes) : null) ?? recipeBaseServings(recipe)
  const all = recipes.some((r) => r.id === recipe.id) ? recipes : [...recipes, recipe]
  return toMenuDayDishes(drafts, shared, all)!
}

// Dagen uten oppskriften. null når dagen da blir tom.
export function withRecipeRemoved(day: MenuDay, recipeId: string, recipes: Recipe[]): MenuDayDishes | null {
  const drafts = draftDishes(day)
  const index = drafts.findIndex((d) => 'recipeId' in d && d.recipeId === recipeId)
  if (index < 0) return null
  const rest = drafts.filter((_, i) => i !== index)
  if (rest.length === 0) return null
  const shared = sharedServings(day, recipes)
  const firstRecipe = rest.flatMap((d) => ('recipeId' in d ? [d.recipeId] : []))[0]
  const firstData = firstRecipe ? recipes.find((r) => r.id === firstRecipe) : undefined
  return toMenuDayDishes(rest, shared ?? (firstData ? recipeBaseServings(firstData) : 1), recipes)
}

// Uken arket åpner på: uken man sist så på i ukesmenyen, men aldri en uke
// som har vært.
export function startWeek(lastShown: string | null, thisWeek: string): string {
  return lastShown && lastShown > thisWeek ? lastShown : thisWeek
}

// «sammen med Taco» / «sammen med Pizza og Salat».
export function togetherWith(titles: string[]): string {
  if (titles.length === 0) return ''
  const list = titles.length === 1 ? titles[0] : `${titles.slice(0, -1).join(', ')} og ${titles[titles.length - 1]}`
  return ` sammen med ${list}`
}
