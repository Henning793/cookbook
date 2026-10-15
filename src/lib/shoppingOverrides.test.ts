import { test } from 'node:test'
import assert from 'node:assert/strict'
import { applyOverrides, type AggregatedIngredient } from './shoppingAggregate.ts'

function item(name: string, amount: number | null, unit: string): AggregatedIngredient {
  return { normalizedName: name.toLowerCase(), displayName: name, unit, amount, scaled: false, sources: [] }
}

test('uten overstyring er varen uendret', () => {
  const [row] = applyOverrides([item('Løk', 2, 'stk')], [])
  assert.equal(row.displayName, 'Løk')
  assert.equal(row.originalName, 'Løk')
  assert.equal(row.amountText, null)
  assert.equal(row.edited, false)
})

test('overstyring på navn + enhet erstatter navn og mengde', () => {
  const [row] = applyOverrides(
    [item('Løk', 2, 'stk')],
    [{ normalized_name: 'løk', unit: 'stk', name: 'Rødløk', amount_text: '1 nett' }]
  )
  assert.equal(row.displayName, 'Rødløk')
  assert.equal(row.originalName, 'Løk')
  assert.equal(row.amountText, '1 nett')
  assert.equal(row.amount, 2)
  assert.equal(row.edited, true)
})

test('overstyringen treffer bare samme enhet', () => {
  const rows = applyOverrides(
    [item('Melk', 2, 'dl'), item('Melk', 1, 'l')],
    [{ normalized_name: 'melk', unit: 'l', name: null, amount_text: '2 l' }]
  )
  assert.equal(rows[0].edited, false)
  assert.equal(rows[1].amountText, '2 l')
})

test('blanke felt i overstyringen betyr utregnet verdi', () => {
  const [row] = applyOverrides(
    [item('Løk', 2, 'stk')],
    [{ normalized_name: 'løk', unit: 'stk', name: '  ', amount_text: null }]
  )
  assert.equal(row.displayName, 'Løk')
  assert.equal(row.edited, false)
})
