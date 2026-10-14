import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  isTechniqueTimerText,
  keepTechniqueSteps,
  techniqueStep,
  techniqueTimerText,
  withTechniqueStep,
} from './techniqueCooking.ts'

test('teknikken husker steget sitt per oppskrift', () => {
  let session = withTechniqueStep({ recipeId: 'lasagne', stepIndex: 3 }, 'lasagne', 'bechamel', 1)
  assert.equal(techniqueStep(session, 'lasagne', 'bechamel'), 1)
  assert.equal(techniqueStep(session, 'grateng', 'bechamel'), null)
  assert.equal(session.stepIndex, 3)
  session = withTechniqueStep(session, 'lasagne', 'bechamel', null)
  assert.equal(techniqueStep(session, 'lasagne', 'bechamel'), null)
  assert.equal(session.techniqueSteps, undefined)
  assert.equal(techniqueStep(null, 'lasagne', 'bechamel'), null)
})

test('teknikkstegene blir med når oppskriftens steg lagres', () => {
  const previous = withTechniqueStep({ recipeId: 'lasagne', stepIndex: 3 }, 'lasagne', 'bechamel', 2)
  const next = keepTechniqueSteps(previous, { recipeId: 'lasagne', stepIndex: 4 })
  assert.deepEqual(next, { recipeId: 'lasagne', stepIndex: 4, techniqueSteps: { 'lasagne:bechamel': 2 } })
})

test('en annen oppskrift tar ikke med teknikkstegene', () => {
  const previous = withTechniqueStep({ recipeId: 'lasagne', stepIndex: 3 }, 'lasagne', 'bechamel', 2)
  assert.deepEqual(keepTechniqueSteps(previous, { recipeId: 'pizza', stepIndex: 0 }), { recipeId: 'pizza', stepIndex: 0 })
  assert.equal(keepTechniqueSteps(previous, null), null)
})

test('på en dag i ukesmenyen beholdes teknikkene i alle rettene', () => {
  let previous = withTechniqueStep({ recipeId: 'lasagne', stepIndex: 3, weekday: 5 }, 'lasagne', 'bechamel', 1)
  previous = withTechniqueStep(previous, 'grateng', 'bechamel', 0)
  const next = keepTechniqueSteps(previous, { recipeId: 'grateng', stepIndex: 2, weekday: 5 })
  assert.deepEqual(next?.techniqueSteps, { 'lasagne:bechamel': 1, 'grateng:bechamel': 0 })
  const otherDay = keepTechniqueSteps(previous, { recipeId: 'grateng', stepIndex: 2, weekday: 6 })
  assert.equal(otherDay?.techniqueSteps, undefined)
})

test('en ferdig rett mister teknikkene sine', () => {
  let previous = withTechniqueStep({ recipeId: 'lasagne', stepIndex: 5, weekday: 5 }, 'lasagne', 'bechamel', 1)
  previous = withTechniqueStep(previous, 'grateng', 'bechamel', 0)
  const next = keepTechniqueSteps(previous, { recipeId: 'grateng', stepIndex: 2, weekday: 5 }, 'lasagne')
  assert.deepEqual(next?.techniqueSteps, { 'grateng:bechamel': 0 })
})

test('klokker i teknikken kjennes igjen på navnet', () => {
  const text = techniqueTimerText('Bechamelsaus', 'La småkoke i 5 min')
  assert.equal(text, 'Bechamelsaus · La småkoke i 5 min')
  assert.equal(isTechniqueTimerText(text, ['Bechamelsaus']), true)
  assert.equal(isTechniqueTimerText('La småkoke i 5 min', ['Bechamelsaus']), false)
})
