import { test } from 'node:test'
import assert from 'node:assert/strict'
import { scannedToFormValues } from './scannedRecipe.ts'
import { ingredientsForStep, stepDisplayText } from './recipeIngredients.ts'
import { stepTimerSeconds } from './stepTimer.ts'

const scanned = {
  is_recipe: true,
  problem: '',
  title: '  Kylling i  marinade ',
  description: '',
  servings: 4,
  loose_ingredients: [
    { amount: 600, unit: 'G', name: 'kyllingfilet' },
    { amount: null, unit: '', name: 'salt' },
    { amount: 2, unit: 'fedd', name: 'hvitløk' },
    { amount: 1, unit: 'stk.', name: '' },
  ],
  components: [
    {
      name: 'Marinade:',
      ingredients: [
        { amount: 2, unit: 'SS', name: 'soyasaus' },
        { amount: 0, unit: 'ts', name: 'honning' },
      ],
    },
    { name: '', ingredients: [{ amount: 1, unit: 'dl', name: 'ris' }] },
    { name: 'Tom gruppe', ingredients: [] },
  ],
  steps: [
    { text: '1. Bland alle ingrediensene til marinaden. @Marinade', timer_minutes: null },
    { text: 'Stek kyllingen i 3 min, og la den trekke under lokk i 20 min. @Ukjent', timer_minutes: 20 },
    { text: 'La hvile i 10 min.', timer_minutes: 10 },
    { text: '   ', timer_minutes: null },
  ],
}

test('rydder tittel, porsjoner og ingredienser', () => {
  const values = scannedToFormValues(scanned)
  assert.equal(values.title, 'Kylling i marinade')
  assert.equal(values.description, null)
  assert.equal(values.servings, 4)
  assert.deepEqual(values.ingredients.loose, [
    { amount: 600, unit: 'g', name: 'kyllingfilet' },
    { amount: null, unit: '', name: 'salt' },
    { amount: 2, unit: 'fedd', name: 'hvitløk' },
    { amount: 1, unit: 'dl', name: 'ris' },
  ])
  assert.deepEqual(values.ingredients.components, [
    {
      name: 'Marinade',
      ingredients: [
        { amount: 2, unit: 'ss', name: 'soyasaus' },
        { amount: null, unit: 'ts', name: 'honning' },
      ],
    },
  ])
})

test('beholder @-koblinger til kjente komponenter og fjerner ukjente', () => {
  const values = scannedToFormValues(scanned)
  assert.equal(values.steps.length, 3)
  assert.equal(values.steps[0], 'Bland alle ingrediensene til marinaden. @Marinade')
  assert.equal(stepDisplayText(values.steps[0], values.ingredients), 'Bland alle ingrediensene til marinaden.')
  assert.deepEqual(
    ingredientsForStep(values.steps[0], values.ingredients).map((g) => g.componentName),
    ['Marinade']
  )
  assert.ok(!values.steps[1].includes('@'))
})

test('lagrer tiden bare når den avviker fra det appen gjetter', () => {
  const values = scannedToFormValues(scanned)
  // Appen ville gjettet 3 min (første tid i teksten); modellen sier 20.
  assert.ok(values.steps[1].endsWith('{tid:20}'))
  assert.equal(stepTimerSeconds(values.steps[1]), 20 * 60)
  assert.equal(values.steps[2], 'La hvile i 10 min.')
})

test('tåler et tomt eller ugyldig svar', () => {
  for (const raw of [null, undefined, 'tekst', {}, { steps: 'x', components: [null], servings: 2.5 }]) {
    const values = scannedToFormValues(raw)
    assert.deepEqual(values, {
      title: '',
      description: null,
      ingredients: { loose: [], components: [] },
      steps: [],
      servings: null,
    })
  }
})
