import { test } from 'node:test'
import assert from 'node:assert/strict'
import { dayHasRecipe, startWeek, togetherWith, withRecipeAdded, withRecipeRemoved } from './menuAdd.ts'
import type { MenuDay, Recipe } from '../types.ts'

function recipe(id: string, servings: number | undefined): Recipe {
  return {
    id,
    created_at: '',
    title: id,
    ingredients: { loose: [], components: [] },
    steps: [],
    image_url: null,
    owner_id: 'u1',
    family_id: null,
    tags: [],
    kind: 'recipe',
    servings,
  }
}

function day(patch: Partial<MenuDay>): MenuDay {
  return {
    id: 'd',
    family_id: null,
    owner_id: 'u1',
    weekday: 4,
    entry_type: null,
    recipe_id: null,
    freetext: null,
    servings: null,
    updated_at: '',
    ...patch,
  }
}

const taco = recipe('taco', 4)
const lasagne = recipe('lasagne', 6)
const salat = recipe('salat', 2)
const recipes = [taco, lasagne, salat]

test('tom dag: oppskriften blir hovedrett med sitt eget antall', () => {
  assert.deepEqual(withRecipeAdded(undefined, lasagne, recipes), {
    entry_type: 'recipe', recipe_id: 'lasagne', freetext: null, servings: null, extra_dishes: [], main_servings: null,
  })
})

test('dag med mat: oppskriften blir ekstra rett som følger dagen', () => {
  const fredag = day({ entry_type: 'recipe', recipe_id: 'taco', servings: 5 })
  assert.deepEqual(withRecipeAdded(fredag, salat, recipes), {
    entry_type: 'recipe', recipe_id: 'taco', freetext: null, servings: 5,
    extra_dishes: [{ recipe_id: 'salat', servings: null }], main_servings: null,
  })
})

test('fritekst-dag: oppskriften legges til etter fritekst', () => {
  const dag = day({ entry_type: 'freetext', freetext: 'Rester' })
  const result = withRecipeAdded(dag, taco, recipes)
  assert.equal(result.entry_type, 'freetext')
  assert.equal(result.servings, null)
  assert.deepEqual(result.extra_dishes, [{ recipe_id: 'taco', servings: null }])
})

test('beholder eget antall på eksisterende retter', () => {
  const dag = day({ entry_type: 'recipe', recipe_id: 'taco', extra_dishes: [{ recipe_id: 'salat', servings: 8 }] })
  const result = withRecipeAdded(dag, lasagne, recipes)
  assert.deepEqual(result.extra_dishes, [
    { recipe_id: 'salat', servings: 8 },
    { recipe_id: 'lasagne', servings: null },
  ])
})

test('fjerner oppskriften, og dagen blir tom når den var alene', () => {
  const dag = day({ entry_type: 'recipe', recipe_id: 'taco', extra_dishes: [{ recipe_id: 'salat', servings: null }] })
  assert.ok(dayHasRecipe(dag, 'salat'))
  assert.deepEqual(withRecipeRemoved(dag, 'salat', recipes)?.extra_dishes, [])
  assert.equal(withRecipeRemoved(day({ entry_type: 'recipe', recipe_id: 'taco' }), 'taco', recipes), null)
})

test('fjerner hovedretten: neste rett blir hovedrett og antallet står', () => {
  const dag = day({ entry_type: 'recipe', recipe_id: 'taco', extra_dishes: [{ recipe_id: 'salat', servings: null }] })
  const result = withRecipeRemoved(dag, 'taco', recipes)
  assert.equal(result?.recipe_id, 'salat')
  assert.equal(result?.servings, 4)
})

test('arket starter aldri i en uke som har vært', () => {
  assert.equal(startWeek(null, '2026-11-09'), '2026-11-09')
  assert.equal(startWeek('2026-11-02', '2026-11-09'), '2026-11-09')
  assert.equal(startWeek('2026-11-16', '2026-11-09'), '2026-11-16')
})

test('meldingen nevner det som står der fra før', () => {
  assert.equal(togetherWith([]), '')
  assert.equal(togetherWith(['Taco']), ' sammen med Taco')
  assert.equal(togetherWith(['Pizza', 'Salat']), ' sammen med Pizza og Salat')
})
