import { test } from 'node:test'
import assert from 'node:assert/strict'
import { descriptionParts, recipeSuggestions } from './descriptionLinks.ts'

const recipes = [
  { id: 'r1', title: 'Rødvinssaus' },
  { id: 'r2', title: 'Ovnsbakte poteter' },
  { id: 'r3', title: 'Ovnsbakte' },
  { id: 'self', title: 'Biff' },
]

test('lenker @Tittel til oppskriften', () => {
  assert.deepEqual(descriptionParts('Dette passer utmerket med @Rødvinssaus.', recipes), [
    { text: 'Dette passer utmerket med ' },
    { text: 'Rødvinssaus', recipeId: 'r1' },
    { text: '.' },
  ])
})

test('lengste tittel vinner og store/små bokstaver spiller ingen rolle', () => {
  assert.deepEqual(descriptionParts('Med @ovnsbakte Poteter og @rødvinssaus', recipes), [
    { text: 'Med ' },
    { text: 'ovnsbakte Poteter', recipeId: 'r2' },
    { text: ' og ' },
    { text: 'rødvinssaus', recipeId: 'r1' },
  ])
})

test('ukjente @-ord og @ midt i ord blir stående som tekst', () => {
  assert.deepEqual(descriptionParts('Server med @Bearnaise, se hei@Biff', recipes), [
    { text: 'Server med @Bearnaise, se hei@Biff' },
  ])
})

test('tittelen må slutte ved ordgrense', () => {
  assert.deepEqual(descriptionParts('@Rødvinssausen er god', recipes), [{ text: '@Rødvinssausen er god' }])
})

test('lenker ikke til oppskriften selv', () => {
  assert.deepEqual(descriptionParts('Mer @Biff', recipes, 'self'), [{ text: 'Mer @Biff' }])
})

test('tom tekst gir ingen biter', () => {
  assert.deepEqual(descriptionParts('', recipes), [])
})

test('forslag: titler som begynner med teksten først, så senere ord', () => {
  assert.deepEqual(recipeSuggestions('ovn', recipes), ['Ovnsbakte', 'Ovnsbakte poteter'])
  assert.deepEqual(recipeSuggestions('pot', recipes), ['Ovnsbakte poteter'])
  assert.deepEqual(recipeSuggestions('', recipes, 'Biff'), ['Ovnsbakte', 'Ovnsbakte poteter', 'Rødvinssaus'])
})
