// Rettene på en dag i ukesmenyen. Hovedretten ligger i recipe_id (eller
// freetext), og resten i extra_dishes. En rett er en oppskrift eller
// fritekst, f.eks. «Salat». Dagen har ett antall for hvor mange som spiser
// (menu_days.servings), og hver oppskrift regnes om fra sitt eget antall. En
// rett kan ha eget antall, f.eks. dobbel saus. Hovedrettens eget antall ligger
// i main_servings, de andres i extra_dishes.
// Ren logikk uten supabase-import, så den kan testes med node --test.
import type { MenuDay, MenuEntryType, MenuExtraDish, Recipe } from '../types.ts'
import { descriptionParts } from './descriptionLinks.ts'

// Oppskrifter uten antall porsjoner regnes som 1 porsjon, som på
// oppskriftssiden (se OppskriftPage).
export function recipeBaseServings(recipe: Pick<Recipe, 'servings'>): number {
  return recipe.servings != null && recipe.servings > 0 ? recipe.servings : 1
}

// Ekstra retter i rekkefølge. Tom liste før migreringen er kjørt.
export function extraDishes(day: Pick<MenuDay, 'extra_dishes'> | undefined): MenuExtraDish[] {
  const list = day?.extra_dishes
  if (!Array.isArray(list)) return []
  const result: MenuExtraDish[] = []
  for (const dish of list) {
    if (!dish) continue
    const servings = typeof dish.servings === 'number' && dish.servings > 0 ? dish.servings : null
    if (typeof dish.recipe_id === 'string') {
      result.push({ recipe_id: dish.recipe_id, servings })
    } else if (typeof dish.freetext === 'string' && dish.freetext.trim()) {
      result.push({ recipe_id: null, freetext: dish.freetext, servings: null })
    }
  }
  return result
}

function positiveOrNull(value: number | null | undefined): number | null {
  return typeof value === 'number' && value > 0 ? value : null
}

// Alle rettene på dagen i rekkefølge, hovedretten først.
function dayEntries(day: MenuDay): MenuExtraDish[] {
  const main: MenuExtraDish[] =
    day.entry_type === 'recipe' && day.recipe_id
      ? [{ recipe_id: day.recipe_id, servings: positiveOrNull(day.main_servings) }]
      : day.entry_type === 'freetext' && day.freetext
        ? [{ recipe_id: null, freetext: day.freetext, servings: null }]
        : []
  return day.entry_type ? [...main, ...extraDishes(day)] : []
}

// Hvor mange som spiser: dagens eget antall, ellers antallet til den første
// oppskriften på dagen. null når dagen ikke har noen oppskrift.
export function sharedServings(day: MenuDay, recipes: Recipe[]): number | null {
  if (day.servings != null && day.servings > 0) return day.servings
  for (const entry of dayEntries(day)) {
    const recipe = entry.recipe_id ? recipes.find((r) => r.id === entry.recipe_id) : undefined
    if (recipe) return recipeBaseServings(recipe)
  }
  return null
}

export interface PlannedDish {
  recipe: Recipe
  // Antallet retten lages til.
  servings: number
  // Oppskriftens eget antall.
  base: number
  // true når retten har eget antall i stedet for å følge dagen.
  own: boolean
}

// En linje i ukesmenyen: en oppskrift (dish) eller fritekst. Slettede
// oppskrifter hoppes over.
export interface MenuDayItem {
  title: string
  dish: PlannedDish | null
}

export function menuDayItems(day: MenuDay, recipes: Recipe[]): MenuDayItem[] {
  const byId = new Map(recipes.map((r) => [r.id, r]))
  const shared = sharedServings(day, recipes)
  const items: MenuDayItem[] = []
  dayEntries(day).forEach((entry) => {
    if (!entry.recipe_id) {
      items.push({ title: entry.freetext ?? '', dish: null })
      return
    }
    const recipe = byId.get(entry.recipe_id)
    if (!recipe) return
    const base = recipeBaseServings(recipe)
    const own = entry.servings !== null
    items.push({
      title: recipe.title,
      dish: { recipe, servings: (own ? entry.servings : null) ?? shared ?? base, base, own },
    })
  })
  return items
}

// Oppskriftene på dagen, med antallet hver skal lages til.
export function plannedDishes(day: MenuDay, recipes: Recipe[]): PlannedDish[] {
  return menuDayItems(day, recipes).flatMap((item) => (item.dish ? [item.dish] : []))
}

// Fritekst-retter i hele uka, for «Ikke dekket av handlelisten».
export function freetextEntries(days: MenuDay[]): { weekday: number; text: string }[] {
  return days.flatMap((day) =>
    dayEntries(day).flatMap((entry) =>
      !entry.recipe_id && entry.freetext ? [{ weekday: day.weekday, text: entry.freetext }] : []
    )
  )
}

// Oppskrifter som rettene lenker til med @ i beskrivelsen, og som ikke
// allerede er med. Brukes som forslag i redigeringsarket.
export function linkedSuggestions(dishIds: string[], recipes: Recipe[]): Recipe[] {
  const chosen = new Set(dishIds)
  const byId = new Map(recipes.map((r) => [r.id, r]))
  const seen = new Set<string>()
  const result: Recipe[] = []
  for (const id of dishIds) {
    const description = byId.get(id)?.description
    if (!description) continue
    for (const part of descriptionParts(description, recipes, id)) {
      if (!part.recipeId || chosen.has(part.recipeId) || seen.has(part.recipeId)) continue
      seen.add(part.recipeId)
      const linked = byId.get(part.recipeId)
      if (linked) result.push(linked)
    }
  }
  return result
}

// En rett slik redigeringsarket holder på den: en oppskrift eller fritekst.
// servings = null følger dagen.
export type DraftDish = { recipeId: string; servings: number | null } | { freetext: string }

// Dagens innhold i et format redigeringsarket kan starte med.
export function draftDishes(day: MenuDay | undefined): DraftDish[] {
  if (!day) return []
  return dayEntries(day).map((entry) =>
    entry.recipe_id ? { recipeId: entry.recipe_id, servings: entry.servings } : { freetext: entry.freetext ?? '' }
  )
}

export interface MenuDayDishes {
  entry_type: MenuEntryType
  recipe_id: string | null
  freetext: string | null
  servings: number | null
  extra_dishes: MenuExtraDish[]
  main_servings: number | null
}

// Gjør om redigeringsarket til det som lagres. Første rett er hovedretten.
// Dagens antall lagres som null når det er lik antallet til første
// oppskrift, og en rett (også hovedretten) som er satt til samme antall som
// dagen følger dagen.
export function toMenuDayDishes(dishes: DraftDish[], shared: number, recipes: Recipe[]): MenuDayDishes | null {
  const [main, ...rest] = dishes
  if (!main) return null
  const firstRecipe = dishes.flatMap((d) => ('recipeId' in d ? [d.recipeId] : []))[0]
  const firstRecipeData = firstRecipe ? recipes.find((r) => r.id === firstRecipe) : undefined
  const firstBase = firstRecipeData ? recipeBaseServings(firstRecipeData) : null
  // Med bare én oppskrift er dagens antall det eneste som gjelder.
  const several = dishes.filter((d) => 'recipeId' in d).length > 1
  const ownServings = (dish: DraftDish) =>
    several && 'recipeId' in dish && dish.servings !== null && dish.servings !== shared ? dish.servings : null
  return {
    entry_type: 'recipeId' in main ? 'recipe' : 'freetext',
    recipe_id: 'recipeId' in main ? main.recipeId : null,
    freetext: 'recipeId' in main ? null : main.freetext,
    servings: firstRecipe === undefined || shared === firstBase ? null : shared,
    extra_dishes: rest.map((dish) =>
      'recipeId' in dish
        ? {
            recipe_id: dish.recipeId,
            servings: ownServings(dish),
          }
        : { recipe_id: null, freetext: dish.freetext, servings: null }
    ),
    main_servings: ownServings(main),
  }
}
