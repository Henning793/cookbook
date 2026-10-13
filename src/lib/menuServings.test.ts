import { test } from 'node:test'
import assert from 'node:assert/strict'
import { FROM_MENU_STATE, isFromMenu, menuRecipePath, parseServingsParam } from './menuServings.ts'

test('adressen får ?porsjoner bare når dagen har eget antall', () => {
  assert.equal(menuRecipePath('r1', 6), '/oppskrift/r1?porsjoner=6')
  assert.equal(menuRecipePath('r1', 2.5), '/oppskrift/r1?porsjoner=2.5')
  assert.equal(menuRecipePath('r1', null), '/oppskrift/r1')
})

test('gyldige porsjonstall leses fra adressen', () => {
  assert.equal(parseServingsParam('6'), 6)
  assert.equal(parseServingsParam('2.5'), 2.5)
})

test('manglende eller ugyldige porsjonstall gir null', () => {
  assert.equal(parseServingsParam(null), null)
  assert.equal(parseServingsParam(''), null)
  assert.equal(parseServingsParam('0'), null)
  assert.equal(parseServingsParam('-2'), null)
  assert.equal(parseServingsParam('tull'), null)
  assert.equal(parseServingsParam('Infinity'), null)
})

test('kjenner igjen at oppskriften ble åpnet fra ukesmenyen', () => {
  assert.equal(isFromMenu(FROM_MENU_STATE), true)
  assert.equal(isFromMenu(null), false)
  assert.equal(isFromMenu({ fromTag: 'Middag' }), false)
  assert.equal(isFromMenu({ fromRecipe: true }), false)
})
