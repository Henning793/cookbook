import { test } from 'node:test'
import assert from 'node:assert/strict'
import { cachedShopping, clearShoppingCache, recipesForDays, rememberShopping, SHOPPING_CACHE_KEY, type ShoppingSnapshot } from './shoppingCache.ts'
import type { MenuDay, Recipe } from '../types.ts'

function memoryStore() {
  const items = new Map<string, string>()
  return {
    items,
    getItem: (key: string) => items.get(key) ?? null,
    setItem: (key: string, value: string) => void items.set(key, value),
    removeItem: (key: string) => void items.delete(key),
  }
}

const snapshot: ShoppingSnapshot = {
  range: 'week',
  end: '2026-10-25',
  days: [],
  checked: [],
  manualItems: [{ id: '1', name: 'Melk', checked: false }],
  overrides: [],
  alwaysHome: [],
  recipes: [],
}

test('viser bare listen til samme bruker, familie og uke', () => {
  const store = memoryStore()
  clearShoppingCache(store)
  rememberShopping(store, 'user-a', 'fam-1', '2026-10-19', snapshot)
  assert.deepEqual(cachedShopping(store, 'user-a', 'fam-1', '2026-10-19'), snapshot)
  assert.equal(cachedShopping(store, 'user-b', 'fam-1', '2026-10-19'), undefined)
  assert.equal(cachedShopping(store, 'user-a', null, '2026-10-19'), undefined)
  assert.equal(cachedShopping(store, 'user-a', 'fam-1', '2026-10-26'), undefined)
  // Før familien er lastet: siste liste brukeren så.
  assert.deepEqual(cachedShopping(store, 'user-a', undefined, '2026-10-19'), snapshot)
})

test('overlever omstart av appen via lagringen', () => {
  const store = memoryStore()
  clearShoppingCache(store)
  rememberShopping(store, 'user-a', null, '2026-10-19', snapshot)
  const saved = store.items.get(SHOPPING_CACHE_KEY)
  assert.ok(saved)
  // Tømmer bare minnet, som når appen startes på nytt.
  clearShoppingCache(memoryStore())
  assert.deepEqual(cachedShopping(store, 'user-a', null, '2026-10-19'), snapshot)
})

test('tømmes ved utlogging, så neste bruker ikke ser forrige liste', () => {
  const store = memoryStore()
  rememberShopping(store, 'user-a', null, '2026-10-19', snapshot)
  clearShoppingCache(store)
  assert.equal(store.items.has(SHOPPING_CACHE_KEY), false)
  assert.equal(cachedShopping(store, 'user-a', null, '2026-10-19'), undefined)
})

test('tåler lagring som kaster', () => {
  const broken = {
    getItem: () => { throw new Error('blokkert') },
    setItem: () => { throw new Error('blokkert') },
    removeItem: () => { throw new Error('blokkert') },
  }
  clearShoppingCache(broken)
  assert.equal(cachedShopping(broken, 'user-a', null, '2026-10-19'), undefined)
  rememberShopping(broken, 'user-a', null, '2026-10-19', snapshot)
  assert.deepEqual(cachedShopping(broken, 'user-a', null, '2026-10-19'), snapshot)
})

test('husker bare oppskriftene som er i menyen', () => {
  const recipe = (id: string) => ({ id, title: id, servings: 4, ingredients: [] }) as unknown as Recipe
  const day = { weekday: 0, week_start: '2026-10-19', entry_type: 'recipe', recipe_id: 'a', extra_dishes: [{ recipe_id: 'b', servings: null }] } as unknown as MenuDay
  const ids = recipesForDays([day], [recipe('a'), recipe('b'), recipe('c')]).map((r) => r.id)
  assert.deepEqual(ids.sort(), ['a', 'b'])
})
