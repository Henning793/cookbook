// Antall varer igjen på handlelisten, til merket på Handleliste i bunnmenyen.
// Samme utregning som handlelisten selv: ukesmenyens ingredienser uten «har
// alltid hjemme» og det som er krysset av, pluss egne varer som ikke er krysset av.
import { listMenuDays } from './menuDays'
import {
  aggregateIngredients,
  ingredientKey,
  listCheckedItems,
  listManualItems,
  removeAlwaysHome,
} from './shoppingList'
import { listStandingItems } from './standingItems'
import type { Recipe } from '../types'

export async function countShoppingItemsLeft(familyId: string | null, recipes: Recipe[]): Promise<number> {
  const [days, checkedRows, manualItems, alwaysHome] = await Promise.all([
    listMenuDays(familyId),
    listCheckedItems(familyId),
    listManualItems(familyId),
    listStandingItems(familyId, 'always_home'),
  ])
  const aggregated = removeAlwaysHome(
    aggregateIngredients(days, recipes),
    new Set(alwaysHome.map((i) => i.normalized_name))
  )
  const checkedKeys = new Set(checkedRows.map((c) => ingredientKey(c.normalized_name, c.unit)))
  const uncheckedCount = aggregated.filter(
    (item) => !checkedKeys.has(ingredientKey(item.normalizedName, item.unit))
  ).length
  return uncheckedCount + manualItems.filter((m) => !m.checked).length
}
