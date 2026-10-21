// Sist hentede handleliste, så den kan vises med en gang neste gang den
// åpnes og hentes på nytt i bakgrunnen (som menuCache for ukesmenyen).
// Ligger i minnet og i localStorage, så den også vises med en gang når
// appen startes på nytt. Den gjelder én bruker og én uke: en annen bruker
// eller en ny uke får aldri se den, og den tømmes ved utlogging (se
// AppContext).
// Ren logikk uten supabase-import, så den kan testes med node --test.
import type { MenuDay, Recipe } from '../types.ts'
import type { CheckState, ItemOverride } from './shoppingAggregate.ts'
import type { ManualItem } from './shoppingList.ts'
import type { ShoppingRange } from './shoppingRange.ts'
import { plannedDishes } from './menuDishes.ts'

export const SHOPPING_CACHE_KEY = 'kokeboka:handleliste'

export interface ShoppingData {
  range: ShoppingRange
  end: string
  days: MenuDay[]
  checked: CheckState[]
  manualItems: ManualItem[]
  overrides: ItemOverride[]
  // normalized_name for «har alltid hjemme».
  alwaysHome: string[]
}

// Med oppskriftene listen er regnet ut fra, så den kan vises før alle
// oppskriftene er hentet når appen starter.
export interface ShoppingSnapshot extends ShoppingData {
  recipes: Recipe[]
}

interface Entry {
  userId: string
  familyId: string | null
  week: string
  snapshot: ShoppingSnapshot
}

type Store = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

let memory: Entry | null = null

function readStored(store: Store): Entry | null {
  try {
    const parsed = JSON.parse(store.getItem(SHOPPING_CACHE_KEY) ?? 'null')
    return parsed && typeof parsed.userId === 'string' && parsed.snapshot ? parsed : null
  } catch {
    return null
  }
}

// familyId undefined betyr at familien ikke er lastet ennå: da brukes den
// siste listen brukeren så, uansett om den var familiens eller egen.
export function cachedShopping(
  store: Store,
  userId: string,
  familyId: string | null | undefined,
  week: string
): ShoppingSnapshot | undefined {
  if (!memory) memory = readStored(store)
  if (!memory || memory.userId !== userId || memory.week !== week) return undefined
  if (familyId !== undefined && memory.familyId !== familyId) return undefined
  return memory.snapshot
}

export function rememberShopping(
  store: Store,
  userId: string,
  familyId: string | null,
  week: string,
  snapshot: ShoppingSnapshot
): void {
  memory = { userId, familyId, week, snapshot }
  try {
    store.setItem(SHOPPING_CACHE_KEY, JSON.stringify(memory))
  } catch {
    // Full eller blokkert lagring: listen huskes da bare i minnet.
  }
}

export function clearShoppingCache(store: Store): void {
  memory = null
  try {
    store.removeItem(SHOPPING_CACHE_KEY)
  } catch {
    // Se rememberShopping.
  }
}

// Oppskriftene som rettene i dagene bruker.
export function recipesForDays(days: MenuDay[], recipes: Recipe[]): Recipe[] {
  const byId = new Map<string, Recipe>()
  for (const day of days) {
    for (const dish of plannedDishes(day, recipes)) byId.set(dish.recipe.id, dish.recipe)
  }
  return [...byId.values()]
}
