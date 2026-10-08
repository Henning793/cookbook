import { test } from 'node:test'
import assert from 'node:assert/strict'
import { sortShoppingItems } from './shoppingSort.ts'

interface Item {
  name: string
  checked: boolean
}

const sort = (items: Item[]) =>
  sortShoppingItems(items, (i) => i.name, (i) => i.checked).map((i) => i.name)

test('sorts alphabetically ignoring case', () => {
  const items = [
    { name: 'tomat', checked: false },
    { name: 'Agurk', checked: false },
    { name: 'melk', checked: false },
    { name: 'Brød', checked: false },
  ]
  assert.deepEqual(sort(items), ['Agurk', 'Brød', 'melk', 'tomat'])
})

test('puts æ, ø and å last in Norwegian order', () => {
  const items = [
    { name: 'Åkerbær', checked: false },
    { name: 'Ørret', checked: false },
    { name: 'Ærter', checked: false },
    { name: 'Zucchini', checked: false },
  ]
  assert.deepEqual(sort(items), ['Zucchini', 'Ærter', 'Ørret', 'Åkerbær'])
})

test('keeps checked items at the bottom, each group alphabetical', () => {
  const items = [
    { name: 'Smør', checked: true },
    { name: 'Tomat', checked: false },
    { name: 'Egg', checked: true },
    { name: 'Agurk', checked: false },
  ]
  assert.deepEqual(sort(items), ['Agurk', 'Tomat', 'Egg', 'Smør'])
})

test('does not mutate the input', () => {
  const items = [
    { name: 'b', checked: false },
    { name: 'a', checked: false },
  ]
  sort(items)
  assert.deepEqual(items.map((i) => i.name), ['b', 'a'])
})
