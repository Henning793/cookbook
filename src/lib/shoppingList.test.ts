import { test } from 'node:test'
import assert from 'node:assert/strict'
import { aggregateIngredients } from './shoppingAggregate.ts'
import type { MenuDay, Recipe } from '../types.ts'

function recipe(
  id: string,
  loose: Recipe['ingredients']['loose'],
  components: Recipe['ingredients']['components'] = []
): Recipe {
  return {
    id,
    created_at: '',
    title: id,
    ingredients: { loose, components },
    steps: [],
    image_url: null,
    owner_id: 'u1',
    family_id: null,
    tags: [],
  }
}

function menuDay(weekday: number, recipeId: string): MenuDay {
  return {
    id: `d${weekday}`,
    family_id: null,
    owner_id: 'u1',
    weekday,
    entry_type: 'recipe',
    recipe_id: recipeId,
    freetext: null,
    updated_at: '',
  }
}

test('sums same normalized name + unit across recipes', () => {
  const recipes = [
    recipe('r1', [{ amount: 2, unit: 'dl', name: 'Melk' }]),
    recipe('r2', [{ amount: 1, unit: 'dl', name: ' melk ' }]),
  ]
  const days = [menuDay(0, 'r1'), menuDay(1, 'r2')]
  const result = aggregateIngredients(days, recipes)
  assert.equal(result.length, 1)
  assert.equal(result[0].amount, 3)
  assert.equal(result[0].unit, 'dl')
  assert.equal(result[0].normalizedName, 'melk')
})

test('keeps different units as separate rows', () => {
  const recipes = [
    recipe('r1', [{ amount: 2, unit: 'dl', name: 'Melk' }]),
    recipe('r2', [{ amount: 3, unit: 'ss', name: 'Melk' }]),
  ]
  const days = [menuDay(0, 'r1'), menuDay(1, 'r2')]
  const result = aggregateIngredients(days, recipes)
  assert.equal(result.length, 2)
})

test('treats differently-worded names as separate rows', () => {
  const recipes = [
    recipe('r1', [{ amount: 1, unit: 'stk', name: 'Paprika' }]),
    recipe('r2', [{ amount: 1, unit: 'stk', name: 'Rød paprika' }]),
  ]
  const days = [menuDay(0, 'r1'), menuDay(1, 'r2')]
  const result = aggregateIngredients(days, recipes)
  assert.equal(result.length, 2)
})

test('flattens component ingredients into the list and skips freetext days', () => {
  const recipes = [
    recipe(
      'r1',
      [{ amount: 1, unit: 'stk', name: 'Løk' }],
      [{ name: 'Sausen', ingredients: [{ amount: 2, unit: 'stk', name: 'løk' }] }]
    ),
  ]
  const days: MenuDay[] = [
    menuDay(0, 'r1'),
    {
      id: 'd1',
      family_id: null,
      owner_id: 'u1',
      weekday: 1,
      entry_type: 'freetext',
      recipe_id: null,
      freetext: 'Taco',
      updated_at: '',
    },
  ]
  const result = aggregateIngredients(days, recipes)
  assert.equal(result.length, 1)
  assert.equal(result[0].normalizedName, 'løk')
  assert.equal(result[0].amount, 3)
})

test('same recipe on multiple days is counted once per day (not deduplicated)', () => {
  const recipes = [recipe('r1', [{ amount: 1, unit: 'stk', name: 'Løk' }])]
  const days = [menuDay(0, 'r1'), menuDay(2, 'r1')]
  const result = aggregateIngredients(days, recipes)
  assert.equal(result.length, 1)
  assert.equal(result[0].amount, 2)
})

test('normalizeItemName trims and lowercases', async () => {
  const { normalizeItemName } = await import('./shoppingAggregate.ts')
  assert.equal(normalizeItemName('  Curry Paste '), 'curry paste')
})

test('removeAlwaysHome hides exact-name matches only', async () => {
  const { removeAlwaysHome } = await import('./shoppingAggregate.ts')
  const items = [
    { normalizedName: 'curry paste', displayName: 'Curry paste', unit: 'ss', amount: 2 },
    { normalizedName: 'rød curry paste', displayName: 'Rød curry paste', unit: 'ss', amount: 1 },
    { normalizedName: 'løk', displayName: 'Løk', unit: 'stk', amount: 1 },
  ]
  const result = removeAlwaysHome(items, new Set(['curry paste']))
  assert.deepEqual(result.map((i) => i.normalizedName), ['rød curry paste', 'løk'])
})

test('planWeeklyAdds inserts missing, skips unchecked duplicates, unchecks checked duplicates', async () => {
  const { planWeeklyAdds } = await import('./shoppingAggregate.ts')
  const weekly = [
    { name: 'Melk', normalized_name: 'melk' },
    { name: 'Brød', normalized_name: 'brød' },
    { name: 'Egg', normalized_name: 'egg' },
  ]
  const manual = [
    { id: 'm1', name: ' melk ', checked: false },
    { id: 'm2', name: 'BRØD', checked: true },
  ]
  const plan = planWeeklyAdds(weekly, manual)
  assert.deepEqual(plan.toInsert.map((i) => i.name), ['Egg'])
  assert.deepEqual(plan.toUncheckIds, ['m2'])
})

test('removeCleared hides only items whose name+unit was cleared', async () => {
  const { removeCleared, ingredientKey } = await import('./shoppingAggregate.ts')
  const items = [
    { normalizedName: 'melk', displayName: 'Melk', unit: 'dl', amount: 8 },
    { normalizedName: 'melk', displayName: 'Melk', unit: 'ss', amount: 2 },
    { normalizedName: 'løk', displayName: 'Løk', unit: 'stk', amount: 1 },
  ]
  const result = removeCleared(items, new Set([ingredientKey('melk', 'dl')]))
  assert.deepEqual(result.map((i) => `${i.normalizedName}/${i.unit}`), ['melk/ss', 'løk/stk'])
})
