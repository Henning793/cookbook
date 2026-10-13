import { test } from 'node:test'
import assert from 'node:assert/strict'
import { moveBetweenGroups, moveTo } from './reorder.ts'

test('moveTo flytter et element til ny plass', () => {
  assert.deepEqual(moveTo(['a', 'b', 'c', 'd'], 0, 2), ['b', 'c', 'a', 'd'])
  assert.deepEqual(moveTo(['a', 'b', 'c', 'd'], 3, 0), ['d', 'a', 'b', 'c'])
  assert.deepEqual(moveTo(['a', 'b', 'c'], 1, 99), ['a', 'c', 'b'])
})

test('moveTo lar lista være når elementet ikke flyttes', () => {
  const items = ['a', 'b']
  assert.equal(moveTo(items, 1, 1), items)
  assert.equal(moveTo(items, 5, 0), items)
})

const groups = () => [
  { name: null, rows: ['salt', 'pepper', 'løk'] },
  { name: 'Marinade', rows: ['soya', 'honning'] },
  { name: 'Saus', rows: [] as string[] },
]

test('moveBetweenGroups flytter en løs ingrediens inn i en komponent', () => {
  const result = moveBetweenGroups(groups(), { group: 0, index: 1 }, { group: 1, index: 1 })
  assert.deepEqual(result[0].rows, ['salt', 'løk'])
  assert.deepEqual(result[1].rows, ['soya', 'pepper', 'honning'])
  assert.equal(result[1].name, 'Marinade')
})

test('moveBetweenGroups kan legge en rad i en tom komponent og tilbake', () => {
  const into = moveBetweenGroups(groups(), { group: 1, index: 0 }, { group: 2, index: 0 })
  assert.deepEqual(into[1].rows, ['honning'])
  assert.deepEqual(into[2].rows, ['soya'])
  const back = moveBetweenGroups(into, { group: 2, index: 0 }, { group: 0, index: 3 })
  assert.deepEqual(back[0].rows, ['salt', 'pepper', 'løk', 'soya'])
  assert.deepEqual(back[2].rows, [])
})

test('moveBetweenGroups bytter rekkefølge innad i en gruppe', () => {
  const result = moveBetweenGroups(groups(), { group: 0, index: 0 }, { group: 0, index: 2 })
  assert.deepEqual(result[0].rows, ['pepper', 'løk', 'salt'])
  const same = groups()
  assert.equal(moveBetweenGroups(same, { group: 0, index: 1 }, { group: 0, index: 1 }), same)
})
