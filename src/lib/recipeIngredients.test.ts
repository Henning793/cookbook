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
    { amount: 1.5, unit: 'dl', name: 'nøytral olje' },
    { amount: 3, unit: 'stk', name: 'modne bananer' },
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

test('short or inflected words in the step match the fuller name in the list', () => {
  assert.deepEqual(summarizeBanan('Sikt melet.'), ['-: 3.5 dl hvetemel'])
  assert.deepEqual(summarizeBanan('Tilsett oljen i en tynn stråle.'), ['-: 1.5 dl nøytral olje'])
  assert.deepEqual(summarizeBanan('Mos bananene.'), ['-: 3 stk modne bananer'])
})

test('a short word matching both a loose ingredient and an unmentioned component goes to the loose one', () => {
  assert.deepEqual(summarizeBanan('Bland mel og egg.'), ['-: 3.5 dl hvetemel, 2 stk egg'])
})

test('@component also matches shortened ingredient names', () => {
  const recipe: RecipeIngredients = {
    loose: [{ amount: 3, unit: 'dl', name: 'Hvetemel' }],
    components: [{ name: 'Topping', ingredients: [{ amount: 1, unit: 'dl', name: 'Hvetemel' }, { amount: 50, unit: 'g', name: 'Smør' }] }],
  }
  assert.deepEqual(
    ingredientsForStep('Smuldre mel og smør @Topping', recipe).map((g) => `${g.componentName}: ${g.items.map((i) => i.name).join(', ')}`),
    ['Topping: Hvetemel, Smør']
  )
})

test('an exact name wins over a looser match for the same word', () => {
  const recipe: RecipeIngredients = {
    loose: [
      { amount: 2, unit: 'ts', name: 'vaniljesukker' },
      { amount: 3, unit: 'dl', name: 'sukker' },
    ],
    components: [],
  }
  assert.deepEqual(
    ingredientsForStep('Pisk sukker og egg.', recipe).flatMap((g) => g.items.map((i) => i.name)),
    ['sukker']
  )
})

test('common short words do not match ingredient endings', () => {
  // "med" er slutten av ingen ingrediens her, men "den" ville truffet f.eks. "ruccoladen" uten stoppord.
  assert.deepEqual(summarizeBanan('Stek den i ovnen med lokk.'), [])
})

test('formatScaledAmount scales, rounds to one decimal and uses comma', () => {
  assert.equal(formatScaledAmount({ amount: 1, unit: 'dl', name: 'x' }, 1.5), '1,5 dl')
  assert.equal(formatScaledAmount({ amount: 3, unit: 'stk', name: 'x' }, 1), '3 stk')
  assert.equal(formatScaledAmount({ amount: null, unit: '', name: 'x' }, 2), '')
})

test('the hidden timer marker is removed like @-links and does not affect ingredients', () => {
  const step = 'Pensle med @Saus og la hvile i 20–30 min. {tid:25}'
  assert.equal(stepDisplayText(step, ingredients), 'Pensle med og la hvile i 20–30 min.')
  assert.deepEqual(
    ingredientsForStep(step, ingredients),
    ingredientsForStep('Pensle med @Saus og la hvile i 20–30 min.', ingredients)
  )
})

test('"alle ingrediensene" shows the whole component even when one ingredient is named', () => {
  const kebab: RecipeIngredients = {
    loose: [{ amount: 2, unit: 'fedd', name: 'hvitløk' }],
    components: [
      {
        name: 'Kebbabdressing',
        ingredients: [
          { amount: 2, unit: 'dl', name: 'rømme' },
          { amount: 1, unit: 'fedd', name: 'hvitløk' },
          { amount: 1, unit: 'ts', name: 'paprikapulver' },
        ],
      },
    ],
  }
  const names = (step: string) =>
    ingredientsForStep(step, kebab).map((g) => `${g.componentName ?? '-'}: ${g.items.map((i) => i.name).join(', ')}`)
  const all = ['Kebbabdressing: rømme, hvitløk, paprikapulver']

  assert.deepEqual(names('Bland sammen alle ingrediensene til dressingen og press i hvitløk. @Kebbabdressing'), all)
  assert.deepEqual(names('Rør sammen alt og smak til med hvitløk @Kebbabdressing'), all)
  assert.deepEqual(names('Ha i resten sammen med hvitløken @Kebbabdressing'), all)
  // Uten kobling, men med komponenten nevnt ved navn.
  assert.deepEqual(names('Bland ingrediensene til kebbabdressingen, press i hvitløk.'), all)
  // Uten et slikt ord vises fortsatt bare det som er nevnt.
  assert.deepEqual(names('Press hvitløk i @Kebbabdressing'), ['Kebbabdressing: hvitløk'])
  assert.deepEqual(names('Smak til med salt og hvitløk @Kebbabdressing'), ['Kebbabdressing: hvitløk'])
})

test('a word that only happens to end an ingredient name is not a mention', () => {
  const lasagne: RecipeIngredients = {
    loose: [{ amount: 9, unit: 'stk', name: 'lasagneplater' }],
    components: [
      { name: 'Kjøttsaus', ingredients: [{ amount: 150, unit: 'g', name: 'bacon eller pancetta' }] },
      { name: 'Ostesaus', ingredients: [{ amount: 3, unit: 'ss', name: 'smør' }] },
    ],
  }
  const step = 'Sett formen i stekeovn på 200° C og stek i 30-40 minutter. Kjenn etter med en pinne om pastaen er mør.'
  assert.deepEqual(ingredientsForStep(step, lasagne), [])
  assert.deepEqual(ingredientsForStep('Smelt smøret og stek pancettaen.', lasagne).flatMap((g) => g.items.map((i) => i.name)), [
    'bacon eller pancetta',
    'smør',
  ])
})

test('the last part of a compound name still matches, also when both are inflected', () => {
  const ingredients: RecipeIngredients = {
    loose: [
      { amount: 5, unit: 'dl', name: 'hvetemel' },
      { amount: 600, unit: 'g', name: 'mandelpoteter' },
    ],
    components: [],
  }
  const names = (step: string) => ingredientsForStep(step, ingredients).flatMap((g) => g.items.map((i) => i.name))
  assert.deepEqual(names('Rør inn melet.'), ['hvetemel'])
  assert.deepEqual(names('Kok potetene møre.'), ['mandelpoteter'])
})

test('a word for the dish being made does not pull in ingredients that end with it', () => {
  const wok: RecipeIngredients = {
    loose: [
      { amount: 2, unit: 'ss', name: 'soyasaus' },
      { amount: 1, unit: 'ss', name: 'fiskesaus' },
      { amount: 5, unit: 'dl', name: 'hvetemel' },
    ],
    components: [],
  }
  const names = (step: string) => ingredientsForStep(step, wok).flatMap((g) => g.items.map((i) => i.name))
  assert.deepEqual(names('La sausen redusere i 1 minutt.'), [])
  assert.deepEqual(names('Elt deigen og hell i blandingen.'), [])
  assert.deepEqual(names('Ha i soyasausen og fiskesaus.'), ['soyasaus', 'fiskesaus'])
  assert.deepEqual(names('Rør inn melet.'), ['hvetemel'])
})

test('"løk" matches rødløk but not hvitløk', () => {
  const recipe: RecipeIngredients = {
    loose: [
      { amount: 1, unit: 'stk', name: 'rødløk' },
      { amount: 2, unit: 'fedd', name: 'hvitløk' },
      { amount: 1, unit: 'stk', name: 'sjalottløk' },
    ],
    components: [],
  }
  const names = (step: string) => ingredientsForStep(step, recipe).flatMap((g) => g.items.map((i) => i.name))
  assert.deepEqual(names('Fres løken i olje.'), ['rødløk', 'sjalottløk'])
  assert.deepEqual(names('Ha i hvitløken.'), ['hvitløk'])
  assert.deepEqual(names('Fres løk og hvitløk.'), ['rødløk', 'hvitløk', 'sjalottløk'])
})

test('shapes, tools and named exceptions do not pull in ingredients', () => {
  const recipe: RecipeIngredients = {
    loose: [
      { amount: 9, unit: 'stk', name: 'lasagneplater' },
      { amount: 1, unit: 'stk', name: 'buljongterning' },
      { amount: 8, unit: 'stk', name: 'kjøttboller' },
      { amount: 4, unit: 'stk', name: 'osteskiver' },
      { amount: 2, unit: 'ss', name: 'karripasta' },
      { amount: 4, unit: 'dl', name: 'kokosmelk' },
      { amount: 2, unit: 'ss', name: 'peanøttsmør' },
      { amount: 1, unit: 'ts', name: 'cayennepepper' },
      { amount: 1, unit: 'klype', name: 'muskatnøtt' },
      { amount: 2, unit: 'dl', name: 'helmelk' },
    ],
    components: [],
  }
  const names = (step: string) => ingredientsForStep(step, recipe).flatMap((g) => g.items.map((i) => i.name))
  assert.deepEqual(names('Legg på en plate og skjær i terninger, skiver eller biter.'), [])
  assert.deepEqual(names('Ha alt i en bolle. Kok pastaen.'), [])
  assert.deepEqual(names('Smelt smøret, hakk nøttene og smak til med salt og pepper.'), [])
  assert.deepEqual(names('Spe med melk.'), ['helmelk'])
  assert.deepEqual(names('Ha i kokosmelken, karripastaen og buljongterningen.'), ['buljongterning', 'karripasta', 'kokosmelk'])
  assert.deepEqual(names('Legg lasagneplatene i formen sammen med kjøttbollene.'), ['lasagneplater', 'kjøttboller'])
})
