import { test } from 'node:test'
import assert from 'node:assert/strict'
import { daysInRange, rangeEnd, rangeEndLabel, rangeWeeks, shortDayLabel } from './shoppingRange.ts'
import { applyChecks, aggregateIngredients, type CheckState } from './shoppingAggregate.ts'
import type { MenuDay, Recipe } from '../types.ts'

const thursday = new Date(2026, 9, 15, 12) // torsdag i uke 42

test('ukeshandling går ut uken, neste 7 dager fra i dag, måned 4 uker til', () => {
  assert.equal(rangeEnd('week', thursday), '2026-10-18')
  assert.equal(rangeEnd('next7', thursday), '2026-10-21')
  assert.equal(rangeEnd('month', thursday), '2026-11-15')
  assert.equal(rangeEnd('next7', new Date(2026, 9, 12)), '2026-10-18') // mandag = ut uken
})

test('henter ukene som perioden dekker', () => {
  assert.deepEqual(rangeWeeks('week', thursday), { from: '2026-10-12', to: '2026-10-12' })
  assert.deepEqual(rangeWeeks('next7', thursday), { from: '2026-10-12', to: '2026-10-19' })
  assert.deepEqual(rangeWeeks('month', thursday), { from: '2026-10-12', to: '2026-11-09' })
})

test('tekster med dato', () => {
  assert.equal(shortDayLabel('2026-10-15'), 'Tor 15.')
  assert.equal(rangeEndLabel('2026-10-21'), 't.o.m. ons 21. okt')
})

function day(week_start: string, weekday: number, recipeId: string): MenuDay {
  return {
    id: `${week_start}-${weekday}`,
    family_id: null,
    owner_id: 'u1',
    week_start,
    weekday,
    entry_type: 'recipe',
    recipe_id: recipeId,
    freetext: null,
    updated_at: '',
  }
}

test('tar med dager fra mandag denne uken til og med siste dag, sortert', () => {
  const days = [
    day('2026-10-19', 3, 'b'), // tor 22.
    day('2026-10-12', 6, 'a'), // søn 18.
    day('2026-10-05', 6, 'x'), // forrige uke
    day('2026-10-12', 0, 'c'), // man 12.
  ]
  assert.deepEqual(
    daysInRange(days, '2026-10-21', thursday).map((d) => d.id),
    ['2026-10-12-0', '2026-10-12-6']
  )
})

function recipe(id: string, amount: number): Recipe {
  return {
    id,
    created_at: '',
    title: id,
    ingredients: { loose: [{ amount, unit: 'stk', name: 'Løk' }], components: [] },
    steps: [],
    image_url: null,
    owner_id: 'u1',
    family_id: null,
    tags: [],
    kind: 'recipe',
  }
}

const recipes = [recipe('curry', 2), recipe('gryte', 3)]
const days = [day('2026-10-12', 3, 'curry'), day('2026-10-19', 2, 'gryte')] // tor 15., ons 21.
const items = aggregateIngredients(days, recipes)
const check = (covered_through: string | null, cleared = false): CheckState => ({
  normalized_name: 'løk',
  unit: 'stk',
  cleared,
  covered_through,
})

test('uten avkrysning vises hele mengden', () => {
  const [item] = applyChecks(items, [], days, recipes, '2026-10-18')
  assert.equal(item.amount, 5)
  assert.equal(item.checked, false)
})

test('avkrysset for hele perioden vises som avkrysset', () => {
  const [item] = applyChecks(items, [check('2026-10-21')], days, recipes, '2026-10-18')
  assert.equal(item.checked, true)
  assert.equal(item.extra, false)
})

test('avkrysset ut uken kommer tilbake med bare det som trengs etterpå', () => {
  const [item] = applyChecks(items, [check('2026-10-18', true)], days, recipes, '2026-10-18')
  assert.equal(item.checked, false)
  assert.equal(item.extra, true)
  assert.equal(item.amount, 3)
})

test('fjernet med «Fjern avkryssede» skjules når den ikke trengs igjen', () => {
  assert.deepEqual(applyChecks(items, [check('2026-10-21', true)], days, recipes, '2026-10-18'), [])
})

test('avkrysning uten dato gjelder ut denne uken', () => {
  const [item] = applyChecks(items, [check(null)], days, recipes, '2026-10-18')
  assert.equal(item.extra, true)
  assert.equal(item.amount, 3)
})
