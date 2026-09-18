import { test } from 'node:test'
import assert from 'node:assert/strict'
import { aggregateIngredients } from './shoppingAggregate.ts'
import type { MenuDay, Recipe } from '../types.ts'

function recipe(id: string, ingredients: Recipe['ingredients']): Recipe {
  return {
    id,
    created_at: '',
    title: id,
    ingredients,
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

test('excludes heading rows and freetext days', () => {
  const recipes = [
    recipe('r1', [
      { amount: null, unit: '', name: 'Til sausen', isHeading: true },
      { amount: 1, unit: 'stk', name: 'Løk' },
    ]),
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
})

test('same recipe on multiple days is counted once per day (not deduplicated)', () => {
  const recipes = [recipe('r1', [{ amount: 1, unit: 'stk', name: 'Løk' }])]
  const days = [menuDay(0, 'r1'), menuDay(2, 'r1')]
  const result = aggregateIngredients(days, recipes)
  assert.equal(result.length, 1)
  assert.equal(result[0].amount, 2)
})
