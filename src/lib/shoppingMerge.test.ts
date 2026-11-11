import { test } from 'node:test'
import assert from 'node:assert/strict'
import { countUnchecked, freetextByDay, mergeShoppingRows } from './shoppingMerge.ts'

const recipe = (name: string, checked = false) => ({ normalizedName: name.toLowerCase(), displayName: name, checked })
const manual = (id: string, name: string, checked = false) => ({ id, name, checked })

const names = (rows: ReturnType<typeof mergeShoppingRows>) =>
  rows.map((row) => (row.kind === 'recipe' ? row.item.displayName : `${row.item.name} (egen)`))

test('mixes menu items and own items alphabetically, checked last', () => {
  const rows = mergeShoppingRows(
    [recipe('Løk'), recipe('Kokosmelk', true), recipe('Basilikum')],
    [manual('1', 'Kaffe'), manual('2', 'Brød', true), manual('3', 'Agurk')]
  )
  assert.deepEqual(names(rows), ['Agurk (egen)', 'Basilikum', 'Kaffe (egen)', 'Løk', 'Brød (egen)', 'Kokosmelk'])
})

test('folds an own item into the menu item with the same name', () => {
  const rows = mergeShoppingRows([recipe('Melk')], [manual('1', ' melk '), manual('2', 'Kaffe')])
  assert.deepEqual(names(rows), ['Kaffe (egen)', 'Melk'])
  const melk = rows.find((row) => row.kind === 'recipe')
  assert.equal(melk?.kind === 'recipe' && melk.manual[0].id, '1')
  assert.equal(countUnchecked(rows), 2)
})

test('groups dishes without a recipe per day, in day order', () => {
  const days = freetextByDay([
    { date: '2026-11-12', text: 'Rester' },
    { date: '2026-11-14', text: 'Ribbe-taco' },
    { date: '2026-11-14', text: 'Is til dessert' },
  ])
  assert.deepEqual(days, [
    { date: '2026-11-12', texts: ['Rester'] },
    { date: '2026-11-14', texts: ['Ribbe-taco', 'Is til dessert'] },
  ])
})
