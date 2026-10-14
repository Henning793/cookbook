import { test } from 'node:test'
import assert from 'node:assert/strict'
import { FROM_RECIPE_STATE, kokemodusExit } from './kokemodusExit.ts'

test('åpnet fra oppskriftssiden: går ett steg tilbake i historikken', () => {
  assert.deepEqual(kokemodusExit('r1', FROM_RECIPE_STATE), { back: true })
})

test('åpnet et annet sted fra: erstatter kokemodus med oppskriften', () => {
  assert.deepEqual(kokemodusExit('r1', null), { back: false, to: '/oppskrift/r1' })
  assert.deepEqual(kokemodusExit('r1', undefined), { back: false, to: '/oppskrift/r1' })
  assert.deepEqual(kokemodusExit('r1', { fromTag: 'Middag' }), { back: false, to: '/oppskrift/r1' })
  assert.deepEqual(kokemodusExit('r1', 'tull'), { back: false, to: '/oppskrift/r1' })
})

test('koker fra en dag i ukesmenyen', () => {
  assert.deepEqual(kokemodusExit('r1', FROM_RECIPE_STATE, 5), { back: true })
  assert.deepEqual(kokemodusExit('r1', null, 5), { back: false, to: '/ukesmeny/dag/5?rett=r1' })
})
