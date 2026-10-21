// Henter alt handlelisten trenger i én runde med parallelle spørringer.
// Handlelisten og merket i bunnmenyen bruker samme henting: kommer de
// samtidig (som når man trykker på Handleliste), deler de svaret.
import { deleteOldChecks, listCheckedItems, listManualItems, listOverrides } from './shoppingList'
import { getShoppingRange } from './shoppingPreferences'
import { listMenuDaysBetween } from './menuDays'
import { listStandingItems } from './standingItems'
import { currentWeekStart } from './menuWeeks'
import { daysInRange, rangeEnd, rangeWeeks } from './shoppingRange'
import { recipesForDays, rememberShopping, cachedShopping, type ShoppingData } from './shoppingCache'
import type { Recipe } from '../types'

const inFlight = new Map<string, Promise<ShoppingData>>()

async function fetchShoppingData(familyId: string | null): Promise<ShoppingData> {
  const week = currentWeekStart()
  // Dagene hentes for den lengste perioden (en måned) samtidig med valget av
  // periode, i stedet for å vente på valget først. Det er bare noen få rader.
  const widest = rangeWeeks('month')
  const [range, allDays, checked, manualItems, alwaysHome, overrides] = await Promise.all([
    getShoppingRange(),
    listMenuDaysBetween(familyId, widest.from, widest.to),
    // Gamle avkrysninger slettes ved siden av, og hoppes over her i stedet
    // for å vente på slettingen.
    Promise.all([
      deleteOldChecks(familyId, week).catch((error) => console.error('Kunne ikke rydde gamle avkrysninger', error)),
      listCheckedItems(familyId),
    ]).then(([, rows]) => rows.filter((row) => !row.covered_through || row.covered_through >= week)),
    listManualItems(familyId),
    listStandingItems(familyId, 'always_home'),
    listOverrides(familyId),
  ])
  const end = rangeEnd(range)
  return {
    range,
    end,
    days: daysInRange(allDays, end),
    checked,
    manualItems,
    overrides,
    alwaysHome: alwaysHome.map((item) => item.normalized_name),
  }
}

// Henter handlelisten og husker den for brukeren. recipes er null mens
// oppskriftene lastes; da beholdes oppskriftene fra forrige gang.
export function loadShoppingData(
  userId: string,
  familyId: string | null,
  recipes: Recipe[] | null
): Promise<ShoppingData> {
  const key = `${userId}:${familyId ?? 'meg'}`
  let request = inFlight.get(key)
  if (!request) {
    request = fetchShoppingData(familyId).finally(() => inFlight.delete(key))
    inFlight.set(key, request)
  }
  return request.then((data) => {
    rememberShoppingData(userId, familyId, data, recipes)
    return data
  })
}

export function rememberShoppingData(
  userId: string,
  familyId: string | null,
  data: ShoppingData,
  recipes: Recipe[] | null
): void {
  const week = currentWeekStart()
  const known = recipes ?? cachedShopping(localStorage, userId, familyId, week)?.recipes ?? []
  rememberShopping(localStorage, userId, familyId, week, { ...data, recipes: recipesForDays(data.days, known) })
}
