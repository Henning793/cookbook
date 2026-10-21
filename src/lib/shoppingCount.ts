// Antall varer igjen på handlelisten, til merket på Handleliste i bunnmenyen.
// Samme utregning som handlelisten selv: ukesmenyens ingredienser i perioden
// personen har valgt, uten «har alltid hjemme» og det som er krysset av,
// pluss egne varer som ikke er krysset av.
// Ren logikk uten supabase-import, så den kan testes med node --test.
import { aggregateIngredients, applyChecks, removeAlwaysHome } from './shoppingAggregate.ts'
import { rangeEnd } from './shoppingRange.ts'
import type { ShoppingData } from './shoppingCache.ts'
import type { Recipe } from '../types.ts'

export function countShoppingItemsLeft(data: ShoppingData, recipes: Recipe[]): number {
  const aggregated = removeAlwaysHome(aggregateIngredients(data.days, recipes), new Set(data.alwaysHome))
  const uncheckedCount = applyChecks(aggregated, data.checked, data.days, recipes, rangeEnd('week')).filter(
    (item) => !item.checked
  ).length
  return uncheckedCount + data.manualItems.filter((m) => !m.checked).length
}
