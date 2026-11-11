// Antall varer igjen på handlelisten, til merket på Handleliste i bunnmenyen.
// Samme utregning som handlelisten selv: ukesmenyens ingredienser i perioden
// personen har valgt, uten «har alltid hjemme» og det som er krysset av,
// pluss egne varer som ikke er krysset av. En egen vare med samme navn som en
// vare fra ukesmenyen er samme rad i listen og telles bare én gang.
// Ren logikk uten supabase-import, så den kan testes med node --test.
import { aggregateIngredients, applyChecks, removeAlwaysHome } from './shoppingAggregate.ts'
import { countUnchecked, mergeShoppingRows } from './shoppingMerge.ts'
import { rangeEnd } from './shoppingRange.ts'
import type { ShoppingData } from './shoppingCache.ts'
import type { Recipe } from '../types.ts'

export function countShoppingItemsLeft(data: ShoppingData, recipes: Recipe[]): number {
  const aggregated = removeAlwaysHome(aggregateIngredients(data.days, recipes), new Set(data.alwaysHome))
  const items = applyChecks(aggregated, data.checked, data.days, recipes, rangeEnd('week'))
  return countUnchecked(mergeShoppingRows(items, data.manualItems))
}
