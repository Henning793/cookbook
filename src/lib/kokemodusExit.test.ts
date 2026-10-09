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
