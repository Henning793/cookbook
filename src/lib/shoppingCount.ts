// Antall varer igjen på handlelisten, til merket på Handleliste i bunnmenyen.
// Samme utregning som handlelisten selv: ukesmenyens ingredienser i perioden
// personen har valgt, uten «har alltid hjemme» og det som er krysset av,
// pluss egne varer som ikke er krysset av.
import {
  aggregateIngredients,
  applyChecks,
  listCheckedItems,
  listManualItems,
  removeAlwaysHome,
} from './shoppingList'
import { getShoppingRange, listMenuDaysInRange } from './shoppingPreferences'
import { rangeEnd } from './shoppingRange'
import { listStandingItems } from './standingItems'
import type { Recipe } from '../types'

export async function countShoppingItemsLeft(familyId: string | null, recipes: Recipe[]): Promise<number> {
  const range = await getShoppingRange()
  const [{ days }, checkedRows, manualItems, alwaysHome] = await Promise.all([
    listMenuDaysInRange(familyId, range),
    listCheckedItems(familyId),
    listManualItems(familyId),
    listStandingItems(familyId, 'always_home'),
  ])
  const aggregated = removeAlwaysHome(
    aggregateIngredients(days, recipes),
    new Set(alwaysHome.map((i) => i.normalized_name))
  )
  const uncheckedCount = applyChecks(aggregated, checkedRows, days, recipes, rangeEnd('week')).filter(
    (item) => !item.checked
  ).length
  return uncheckedCount + manualItems.filter((m) => !m.checked).length
}
