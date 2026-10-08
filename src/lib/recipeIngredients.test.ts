import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  allIngredients,
  formatScaledAmount,
  ingredientsForStep,
  normalizeIngredients,
  stepDisplayText,
  componentSuggestions,
} from './recipeIngredients.ts'
import type { RecipeIngredients } from '../types.ts'

const ingredients: RecipeIngredients = {
  loose: [
    { amount: 3, unit: 'ss', name: 'salt' },
    { amount: 1, unit: 'ts', name: 'sukker' },
  ],
  components: [
    {
      name: 'Marinade',
      ingredients: [
        { amount: 2, unit: 'dl', name: 'buttermilk' },
        { amount: 2, unit: 'ss', name: 'salt' },
        { amount: 1, unit: 'ss', name: 'hvitløkspulver' },
      ],
    },
    {
      name: 'Saus',
      ingredients: [
        { amount: 1, unit: 'dl', name: 'soyasaus' },
        { amount: 1, unit: 'ss', name: 'honning' },
      ],
    },
  ],
}

function summarize(stepText: string): string[] {
  return ingredientsForStep(stepText, ingredients).map(
    (g) => `${g.componentName ?? '-'}: ${g.items.map((i) => `${i.amount} ${i.unit} ${i.name}`).join(', ')}`
  )
}

test('normalizeIngredients converts legacy headings to components', () => {
  const result = normalizeIngredients([
    { amount: 1, unit: 'stk', name: 'Løk' },
    { amount: null, unit: '', name: ' Til sausen ', isHeading: true },
    { amount: 2, unit: 'dl', name: 'Fløte' },
    { amount: null, unit: '', name: 'Til toppen', isHeading: true },
    { amount: 1, unit: 'ss', name: 'Persille' },
  ])
  assert.deepEqual(result.loose, [{ amount: 1, unit: 'stk', name: 'Løk' }])
  assert.equal(result.components.length, 2)
  assert.equal(result.components[0].name, 'Til sausen')
  assert.deepEqual(result.components[0].ingredients, [{ amount: 2, unit: 'dl', name: 'Fløte' }])
  assert.equal(result.components[1].name, 'Til toppen')
})

test('normalizeIngredients passes through the new format and tolerates junk', () => {
  assert.deepEqual(normalizeIngredients(ingredients), ingredients)
  assert.deepEqual(normalizeIngredients(null), { loose: [], components: [] })
  assert.deepEqual(normalizeIngredients('x'), { loose: [], components: [] })
  const partial = normalizeIngredients({ loose: [{ name: 'Salt' }], components: [{ name: 'A' }, 5] })
  assert.deepEqual(partial.loose, [{ amount: null, unit: '', name: 'Salt' }])
  assert.deepEqual(partial.components, [{ name: 'A', ingredients: [] }])
})

test('allIngredients flattens loose first, then components in order', () => {
  assert.deepEqual(
    allIngredients(ingredients).map((i) => i.name),
    ['salt', 'sukker', 'buttermilk', 'salt', 'hvitløkspulver', 'soyasaus', 'honning']
  )
})

test('mentioned component: only the ingredients named in the step, component salt wins over loose salt', () => {
  assert.deepEqual(summarize('Bland buttermilk og salt i marinaden.'), [
    'Marinade: 2 dl buttermilk, 2 ss salt',
  ])
})

test('mentioned component with no ingredient named shows the whole component', () => {
  assert.deepEqual(summarize('Hell marinaden over kyllingen.'), [
    'Marinade: 2 dl buttermilk, 2 ss salt, 1 ss hvitløkspulver',
  ])
})

test('no component mentioned: loose ingredients are used', () => {
  assert.deepEqual(summarize('Smak til med salt og sukker.'), ['-: 3 ss salt, 1 ts sukker'])
})

test('loose ingredient not in the mentioned component is still shown', () => {
  assert.deepEqual(summarize('Rør sukker inn i marinaden.'), [
    '-: 1 ts sukker',
    'Marinade: 2 dl buttermilk, 2 ss salt, 1 ss hvitløkspulver',
  ])
})

test('ingredient only inside an unmentioned component is shown under that component', () => {
  assert.deepEqual(summarize('Tilsett honning.'), ['Saus: 1 ss honning'])
})

test('component name only matches at the start of a word', () => {
  // "soyasaus" inneholder "saus", men skal ikke utløse komponenten "Saus".
  assert.deepEqual(summarize('Ha i soyasaus.'), ['Saus: 1 dl soyasaus'])
  // Hele sausen vises ikke (da hadde honning også vært med).
})

test('component mentioned in inflected form', () => {
  assert.deepEqual(summarize('Server med sausen.'), ['Saus: 1 dl soyasaus, 1 ss honning'])
})

test('step with nothing relevant gives no groups', () => {
  assert.deepEqual(summarize('Stek i ovnen i 20 minutter.'), [])
})

const bananbrod: RecipeIngredients = {
  loose: [
    { amount: 3.5, unit: 'dl', name: 'hvetemel' },
    { amount: 2, unit: 'stk', name: 'egg' },
  ],
  components: [
    {
      name: 'Støving av form',
      ingredients: [
        { amount: 2, unit: 'ss', name: 'Smør' },
        { amount: 2, unit: 'ss', name: 'Mel' },
      ],
    },
  ],
}

function summarizeBanan(stepText: string): string[] {
  return ingredientsForStep(stepText, bananbrod).map(
    (g) => `${g.componentName ?? '-'}: ${g.items.map((i) => `${i.amount} ${i.unit} ${i.name}`).join(', ')}`
  )
}

test('ingredient names only match at the start of a word ("hvetemel" is not "Mel")', () => {
  assert.deepEqual(summarizeBanan('Støv formen med hvetemel.'), ['-: 3.5 dl hvetemel'])
})

test('@component: only ingredients named in the step, taken from that component', () => {
  assert.deepEqual(summarizeBanan('Smør formen og støv den med mel fra @Støving av form.'), [
    'Støving av form: 2 ss Smør, 2 ss Mel',
  ])
  assert.deepEqual(summarizeBanan('Støv formen med mel (@støving av form).'), ['Støving av form: 2 ss Mel'])
})

test('@component with no ingredient named shows the whole component, never loose items', () => {
  assert.deepEqual(summarizeBanan('Gjør klar @Støving av form og pisk egg.'), [
    'Støving av form: 2 ss Smør, 2 ss Mel',
  ])
})

test('unknown @ words are plain text and fall back to guessing', () => {
  assert.deepEqual(summarizeBanan('Bland @noe og egg.'), ['-: 2 stk egg'])
})

test('stepDisplayText hides links but keeps unknown @ words', () => {
  assert.equal(
    stepDisplayText('Bland sammen ingrediensene til marinaden. @Støving av form', bananbrod),
    'Bland sammen ingrediensene til marinaden.'
  )
  assert.equal(stepDisplayText('Støv den med mel @Støving av form. @ukjent', bananbrod), 'Støv den med mel. @ukjent')
  assert.equal(stepDisplayText('Støv med mel (@Støving av form).', bananbrod), 'Støv med mel.')
  // Midt i et ord (f.eks. en e-postadresse) er @ ikke en kobling.
  assert.equal(stepDisplayText('ola@Støving av form', bananbrod), 'ola@Støving av form')
})

test('componentSuggestions matches the start of component names', () => {
  assert.deepEqual(
    componentSuggestions('stø', bananbrod).map((c) => c.name),
    ['Støving av form']
  )
  assert.deepEqual(componentSuggestions('x', bananbrod), [])
})

test('formatScaledAmount scales, rounds to one decimal and uses comma', () => {
  assert.equal(formatScaledAmount({ amount: 1, unit: 'dl', name: 'x' }, 1.5), '1,5 dl')
  assert.equal(formatScaledAmount({ amount: 3, unit: 'stk', name: 'x' }, 1), '3 stk')
  assert.equal(formatScaledAmount({ amount: null, unit: '', name: 'x' }, 2), '')
})
