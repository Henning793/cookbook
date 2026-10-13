import { test } from 'node:test'
import assert from 'node:assert/strict'
import { descriptionParts } from './descriptionLinks.ts'

const recipes = [
  { id: 'r1', title: 'Rødvinssaus' },
  { id: 'r2', title: 'Ovnsbakte poteter' },
  { id: 'self', title: 'Biff' },
]

test('lenker tittelen mellom stjernene til oppskriften', () => {
  assert.deepEqual(descriptionParts('Dette passer utmerket med *Rødvinssaus*.', recipes), [
    { text: 'Dette passer utmerket med ' },
    { text: 'Rødvinssaus', recipeId: 'r1' },
    { text: '.' },
  ])
})

test('ser bort fra store og små bokstaver og mellomrom', () => {
  assert.deepEqual(descriptionParts('Med *ovnsbakte Poteter * og *rødvinssaus*', recipes), [
    { text: 'Med ' },
    { text: 'ovnsbakte Poteter ', recipeId: 'r2' },
    { text: ' og ' },
    { text: 'rødvinssaus', recipeId: 'r1' },
  ])
})

test('uten treff vises ordet uten stjerner og uten lenke', () => {
  assert.deepEqual(descriptionParts('Server med *Bearnaise* til.', recipes), [
    { text: 'Server med Bearnaise til.' },
  ])
})

test('lenker ikke til oppskriften selv', () => {
  assert.deepEqual(descriptionParts('Mer *Biff*', recipes, 'self'), [{ text: 'Mer Biff' }])
})

test('tekst uten stjerner er uendret', () => {
  assert.deepEqual(descriptionParts('Bare tekst', recipes), [{ text: 'Bare tekst' }])
  assert.deepEqual(descriptionParts('', recipes), [])
})

test('enslig stjerne og stjerner over linjeskift lenker ikke', () => {
  assert.deepEqual(descriptionParts('5 * 2 og\n*Rødvinssaus\n*', recipes), [
    { text: '5 * 2 og\n*Rødvinssaus\n*' },
  ])
})
