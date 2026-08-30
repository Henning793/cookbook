import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  parseIngredientLine,
  normalizeSteps,
  extractRecipeJsonLd,
  normalizeRecipe,
} from './parseRecipe.mjs'

test('parseIngredientLine tolker mengde, enhet og navn', () => {
  assert.deepEqual(parseIngredientLine('300 g kylling'), { amount: 300, unit: 'g', name: 'kylling' })
})

test('parseIngredientLine tolker brøk', () => {
  assert.deepEqual(parseIngredientLine('1/2 ts salt'), { amount: 0.5, unit: 'ts', name: 'salt' })
})

test('parseIngredientLine tolker desimaltall med komma', () => {
  assert.deepEqual(parseIngredientLine('2,5 dl melk'), { amount: 2.5, unit: 'dl', name: 'melk' })
})

test('parseIngredientLine faller tilbake til ren tekst uten mengde/enhet', () => {
  assert.deepEqual(parseIngredientLine('salt etter smak'), { amount: null, unit: '', name: 'salt etter smak' })
})

test('parseIngredientLine tolker enhet uten mengde', () => {
  assert.deepEqual(parseIngredientLine('boks hermetiske tomater'), { amount: null, unit: 'boks', name: 'hermetiske tomater' })
})

test('normalizeSteps deler en enkelt tekststreng på linjeskift', () => {
  assert.deepEqual(normalizeSteps('Stek løken.\nTilsett krydder.'), ['Stek løken.', 'Tilsett krydder.'])
})

test('normalizeSteps bruker et array av strenger direkte', () => {
  assert.deepEqual(normalizeSteps(['Stek løken.', 'Tilsett krydder.']), ['Stek løken.', 'Tilsett krydder.'])
})

test('normalizeSteps trekker ut text fra HowToStep-objekter', () => {
  const instructions = [
    { '@type': 'HowToStep', text: 'Stek løken.' },
    { '@type': 'HowToStep', text: 'Tilsett krydder.' },
  ]
  assert.deepEqual(normalizeSteps(instructions), ['Stek løken.', 'Tilsett krydder.'])
})

test('normalizeSteps går inn i HowToSection', () => {
  const instructions = [
    {
      '@type': 'HowToSection',
      name: 'Saus',
      itemListElement: [{ '@type': 'HowToStep', text: 'Bland sausen.' }],
    },
  ]
  assert.deepEqual(normalizeSteps(instructions), ['Bland sausen.'])
})

test('normalizeSteps returnerer tom liste for manglende data', () => {
  assert.deepEqual(normalizeSteps(undefined), [])
})

test('extractRecipeJsonLd finner en direkte Recipe-node', () => {
  const html = `
    <html><head>
    <script type="application/ld+json">
    { "@context": "https://schema.org", "@type": "Recipe", "name": "Curry" }
    </script>
    </head></html>
  `
  const result = extractRecipeJsonLd(html)
  assert.equal(result.name, 'Curry')
})

test('extractRecipeJsonLd finner Recipe inni @graph', () => {
  const html = `
    <script type="application/ld+json">
    { "@graph": [ { "@type": "WebPage" }, { "@type": "Recipe", "name": "Pizza" } ] }
    </script>
  `
  const result = extractRecipeJsonLd(html)
  assert.equal(result.name, 'Pizza')
})

test('extractRecipeJsonLd returnerer null når ingen Recipe finnes', () => {
  const html = '<script type="application/ld+json">{ "@type": "WebPage" }</script>'
  assert.equal(extractRecipeJsonLd(html), null)
})

test('extractRecipeJsonLd hopper over ugyldig JSON og fortsetter', () => {
  const html = `
    <script type="application/ld+json">{ ikke gyldig json </script>
    <script type="application/ld+json">{ "@type": "Recipe", "name": "Suppe" }</script>
  `
  const result = extractRecipeJsonLd(html)
  assert.equal(result.name, 'Suppe')
})

test('normalizeRecipe setter sammen tittel, ingredienser og steg', () => {
  const node = {
    name: 'Curry',
    recipeIngredient: ['300 g kylling', 'salt etter smak'],
    recipeInstructions: ['Stek kyllingen.', 'Server.'],
  }
  assert.deepEqual(normalizeRecipe(node), {
    title: 'Curry',
    ingredients: [
      { amount: 300, unit: 'g', name: 'kylling' },
      { amount: null, unit: '', name: 'salt etter smak' },
    ],
    steps: ['Stek kyllingen.', 'Server.'],
  })
})

test('parseIngredientLine kutter ikke bokstaver fra navn som starter med en enhetsbokstav (g)', () => {
  assert.deepEqual(parseIngredientLine('gulrot'), { amount: null, unit: '', name: 'gulrot' })
})

test('parseIngredientLine kutter ikke bokstaver fra navn som starter med en enhetsbokstav (l)', () => {
  assert.deepEqual(parseIngredientLine('løk'), { amount: null, unit: '', name: 'løk' })
})

test('parseIngredientLine med mengde og navn som starter med enhetsbokstav', () => {
  assert.deepEqual(parseIngredientLine('2 gulrøtter'), { amount: 2, unit: '', name: 'gulrøtter' })
})
