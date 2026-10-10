import { test } from 'node:test'
import assert from 'node:assert/strict'
import { findIngredientGroups } from './ingredientGroups.mjs'
import { normalizeRecipe, parseServings } from './parseRecipe.mjs'

test('overskrift midt i listen starter en gruppe, ingrediensene foran blir løse', () => {
  const html = `
    <h1>Smuldrepai med epler</h1>
    <h2>Ingredienser</h2>
    <div>8</div><div>porsjoner</div>
    <ul><li>5 stykker eple</li><li>3 ss sukker, gjerne brunt sukker</li></ul>
    <h3>Smuldredeig</h3>
    <ul><li>100 g smør</li><li>80 g hvetemel</li></ul>
    <h2>Slik gjør du:</h2>
    <div>Skrell og rens eplene.</div>`
  const lines = ['5 stykker eple', '3 ss sukker', '100 g smør', '80 g hvetemel']
  assert.deepEqual(findIngredientGroups(html, lines), [null, null, 'Smuldredeig', 'Smuldredeig'])
})

test('overskrift over første ingrediens blir gruppe når den ligner de andre', () => {
  const html = `
    <h2>Ingredienser</h2>
    <h3>Deig</h3>
    <ul><li>5 dl hvetemel</li><li>1 ts salt</li></ul>
    <h3>Fyll:</h3>
    <ul><li>1 stk. purre</li><li>200 g fetaost</li></ul>`
  const lines = ['5 dl hvetemel', '1 ts salt', '1 stk. purre', '200 g fetaost']
  assert.deepEqual(findIngredientGroups(html, lines), ['Deig', 'Deig', 'Fyll', 'Fyll'])
})

test('uthevet avsnitt teller som overskrift, og linjer delt på flere elementer finnes', () => {
  const html = `
    <p>En god og enkel middag med mye smak.</p>
    <table>
      <tr><td>400 g</td><td>kyllingfilet</td></tr>
      <tr><td>1 ss</td><td>olje</td></tr>
    </table>
    <p><strong>Marinade</strong></p>
    <ul>
      <li><span>2</span> <span>ss</span> <a href="/soyasaus">soyasaus</a></li>
      <li><span>1</span> <span>ts</span> honning</li>
    </ul>`
  const lines = ['400 g kyllingfilet', '1 ss olje', '2 ss soyasaus', '1 ts honning']
  assert.deepEqual(findIngredientGroups(html, lines), [null, null, 'Marinade', 'Marinade'])
})

test('linjer finnes selv om dataene mangler mengden som står på siden', () => {
  const html = `
    <h4>Dette trenger du:</h4>
    <p>4 stk laks</p>
    <h4>Rotgrønnsaker:</h4>
    <p>3 stk gulrøtter</p><p>2 ss olivenolje</p>
    <h4>Dillyoghurt:</h4>
    <p>2 dl yoghurt naturell</p>`
  const lines = ['laks', 'gulrøtter', 'olivenolje', 'yoghurt naturell']
  assert.deepEqual(findIngredientGroups(html, lines), [null, 'Rotgrønnsaker', 'Rotgrønnsaker', 'Dillyoghurt'])
})

test('løse ingredienser øverst på siden blir løse selv om dataene har dem sist', () => {
  const html = `
    <h2>Ingredienser</h2>
    <div>porsjoner</div>
    <ul><li>9 stk. lasagneplater</li><li>3 dl revet hvitost til toppen</li></ul>
    <h3>Kjøttsaus:</h3>
    <ul><li>400 g kjøttdeig</li><li>2 ss tomatpuré</li></ul>
    <h3>Ostesaus:</h3>
    <ul><li>3 ss smør</li><li>6 dl melk</li></ul>`
  const lines = ['400 g kjøttdeig', '2 ss tomatpuré', '3 ss smør', '6 dl melk', '9 stk. lasagneplater', '3 dl revet hvitost til toppen']
  assert.deepEqual(findIngredientGroups(html, lines), ['Kjøttsaus', 'Kjøttsaus', 'Ostesaus', 'Ostesaus', null, null])
})

test('samme ingrediens i to grupper holdes fra hverandre', () => {
  const html = `
    <h3>Deig</h3>
    <ul><li>5 dl hvetemel</li><li>1 ts salt</li></ul>
    <h3>Fyll</h3>
    <ul><li>200 g fetaost</li><li>1 ts salt</li></ul>`
  const lines = ['5 dl hvetemel', '1 ts salt', '200 g fetaost', '1 ts salt']
  assert.deepEqual(findIngredientGroups(html, lines), ['Deig', 'Deig', 'Fyll', 'Fyll'])
})

test('ingen grupper når listen ikke har overskrifter', () => {
  const html = '<h2>Ingredienser</h2><ul><li>2 egg</li><li>3 dl melk</li><li>2 dl hvetemel</li></ul>'
  assert.deepEqual(findIngredientGroups(html, ['2 egg', '3 dl melk', '2 dl hvetemel']), [null, null, null])
})

test('én overskrift over hele listen er ikke en gruppe', () => {
  const html = '<h3>Pannekaker</h3><ul><li>2 egg</li><li>3 dl melk</li></ul>'
  assert.deepEqual(findIngredientGroups(html, ['2 egg', '3 dl melk']), [null, null])
})

test('overskrifter med tall brukes ikke som gruppenavn', () => {
  const html = `
    <h3>En kake gir ca. 24 porsjoner</h3>
    <ul><li>250 g smør</li><li>4 egg</li></ul>
    <h3>Glasur</h3>
    <ul><li>300 g melis</li></ul>`
  assert.deepEqual(findIngredientGroups(html, ['250 g smør', '4 egg', '300 g melis']), [null, null, 'Glasur'])
})

test('ingen grupper når ingrediensene ikke finnes igjen på siden', () => {
  const html = '<h3>Deig</h3><ul><li>mel</li></ul><h3>Fyll</h3><ul><li>ost</li></ul>'
  const lines = ['5 dl hvetemel', '1 ts salt', '200 g fetaost']
  assert.deepEqual(findIngredientGroups(html, lines), [null, null, null])
})

test('skript og kommentarer på siden forstyrrer ikke', () => {
  const html = `
    <script>var x = "<li>2 egg</li><h3>Tull</h3><li>3 dl melk</li>"</script>
    <!-- <h3>Gammelt</h3> -->
    <ul><li>2 egg</li><li>3 dl melk</li></ul>
    <h4>Topping</h4>
    <ul><li>1 dl bl&aring;b&aelig;r</li></ul>`
  assert.deepEqual(findIngredientGroups(html, ['2 egg', '3 dl melk', '1 dl blåbær']), [null, null, 'Topping'])
})

test('normalizeRecipe deler ingrediensene i løse og elementer', () => {
  const html = `
    <ul><li>400 g kyllingfilet</li><li>1 ss olje</li></ul>
    <h3>Marinade</h3>
    <ul><li>2 ss soyasaus</li><li>1 ts honning</li></ul>`
  const recipe = normalizeRecipe(
    {
      '@type': 'Recipe',
      name: 'Kylling med marinade',
      recipeYield: '4 porsjoner',
      recipeIngredient: ['400 g kyllingfilet', '1 ss olje', '2 ss soyasaus', '1 ts honning'],
      recipeInstructions: [{ '@type': 'HowToStep', text: 'Bland marinaden.' }],
    },
    html
  )
  assert.equal(recipe.servings, 4)
  assert.equal(recipe.ingredients.length, 4)
  assert.deepEqual(recipe.loose, [
    { amount: 400, unit: 'g', name: 'kyllingfilet' },
    { amount: 1, unit: 'ss', name: 'olje' },
  ])
  assert.deepEqual(recipe.components, [
    {
      name: 'Marinade',
      ingredients: [
        { amount: 2, unit: 'ss', name: 'soyasaus' },
        { amount: 1, unit: 'ts', name: 'honning' },
      ],
    },
  ])
})

test('normalizeRecipe uten HTML gir bare løse ingredienser', () => {
  const recipe = normalizeRecipe({ name: 'Suppe', recipeIngredient: ['1 l vann', '4 stk. potet'] })
  assert.deepEqual(recipe.components, [])
  assert.deepEqual(recipe.loose, [
    { amount: 1, unit: 'l', name: 'vann' },
    { amount: 4, unit: 'stk', name: 'potet' },
  ])
  assert.equal(recipe.servings, null)
})

test('parseServings leser tall, tekst og liste', () => {
  assert.equal(parseServings(8), 8)
  assert.equal(parseServings('4 PORSJONER'), 4)
  assert.equal(parseServings(['6', '6 porsjoner']), 6)
  assert.equal(parseServings('en langpanne'), null)
  assert.equal(parseServings(undefined), null)
})
