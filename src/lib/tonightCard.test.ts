import { test } from 'node:test'
import assert from 'node:assert/strict'
import { joinTitles, otherCooking, tonightCard } from './tonightCard.ts'
import { COOKING_SESSION_MAX_AGE_MS, isRecentCookingSession } from './cookingSession.ts'
import type { MenuDay, Recipe } from '../types.ts'

function recipe(id: string, extra: Partial<Recipe> = {}): Recipe {
  return {
    id,
    created_at: '',
    title: id,
    ingredients: { loose: [], components: [] },
    steps: ['a', 'b', 'c', 'd', 'e', 'f'],
    image_url: `https://bilde/${id}.jpg`,
    owner_id: 'u1',
    family_id: null,
    tags: [],
    kind: 'recipe',
    servings: 4,
    ...extra,
  }
}

function day(patch: Partial<MenuDay>): MenuDay {
  return {
    id: 'd1',
    family_id: null,
    owner_id: 'u1',
    weekday: 1,
    entry_type: 'recipe',
    recipe_id: 'Lasagne',
    freetext: null,
    updated_at: '',
    ...patch,
  }
}

const recipes = [recipe('Lasagne'), recipe('Salat', { image_url: null }), recipe('Taco')]

test('ingen plan gir tomt kort', () => {
  assert.deepEqual(tonightCard(null, 1, recipes, null), { kind: 'empty' })
  assert.deepEqual(tonightCard(day({ entry_type: null, recipe_id: null }), 1, recipes, null), { kind: 'empty' })
})

test('slettet oppskrift gir tomt kort', () => {
  assert.deepEqual(tonightCard(day({ recipe_id: 'Borte' }), 1, recipes, null), { kind: 'empty' })
})

test('fritekst går til ukesmenyen', () => {
  const card = tonightCard(day({ entry_type: 'freetext', recipe_id: null, freetext: 'Pizza og rester' }), 1, recipes, null)
  assert.deepEqual(card, { kind: 'freetext', title: 'Pizza og rester' })
})

test('én oppskrift som ikke er startet åpner oppskriften', () => {
  const card = tonightCard(day({}), 1, recipes, null)
  assert.equal(card.kind, 'recipe')
  if (card.kind !== 'recipe') return
  assert.equal(card.title, 'Lasagne')
  assert.equal(card.openPath, '/oppskrift/Lasagne')
  assert.equal(card.servings, null)
  assert.deepEqual(card.imageUrls, ['https://bilde/Lasagne.jpg'])
  assert.equal(card.progress, null)
})

test('dagens antall følger med til oppskriften', () => {
  const card = tonightCard(day({ servings: 6 }), 1, recipes, null)
  assert.equal(card.kind === 'recipe' && card.openPath, '/oppskrift/Lasagne?porsjoner=6')
  assert.equal(card.kind === 'recipe' && card.servings, 6)
})

test('startet oppskrift viser steget og går tilbake til kokemodus', () => {
  const card = tonightCard(day({}), 1, recipes, { recipeId: 'Lasagne', stepIndex: 1 })
  assert.equal(card.kind, 'recipe')
  if (card.kind !== 'recipe') return
  assert.equal(card.progress?.stepIndex, 1)
  assert.equal(card.progress?.totalSteps, 6)
  assert.equal(card.progress?.resumePath, '/oppskrift/Lasagne/kok')
})

test('en annen oppskrift i gang regnes ikke som startet', () => {
  const session = { recipeId: 'Taco', stepIndex: 3 }
  const card = tonightCard(day({}), 1, recipes, session)
  assert.equal(card.kind === 'recipe' && card.progress, null)
  assert.equal(otherCooking(card, session, recipes)?.recipe.id, 'Taco')
})

test('samme oppskrift startet fra en annen dag regnes ikke som startet', () => {
  const card = tonightCard(day({}), 1, recipes, { recipeId: 'Lasagne', stepIndex: 2, weekday: 4 })
  assert.equal(card.kind === 'recipe' && card.progress, null)
})

test('oppskrift og fritekst vises sammen, men åpner oppskriften', () => {
  const card = tonightCard(
    day({ extra_dishes: [{ recipe_id: null, freetext: 'Brød', servings: null }] }),
    1,
    recipes,
    null
  )
  assert.equal(card.kind, 'recipe')
  assert.equal(card.kind === 'recipe' && card.title, 'Lasagne og Brød')
})

test('flere oppskrifter åpner dagssiden', () => {
  const session = { recipeId: 'Salat', stepIndex: 0, weekday: 1 }
  const card = tonightCard(
    day({ extra_dishes: [{ recipe_id: 'Salat', servings: null }] }),
    1,
    recipes,
    session
  )
  assert.equal(card.kind, 'day')
  if (card.kind !== 'day') return
  assert.equal(card.title, 'Lasagne og Salat')
  assert.equal(card.dishCount, 2)
  assert.equal(card.openPath, '/ukesmeny/dag/1')
  assert.deepEqual(card.imageUrls, ['https://bilde/Lasagne.jpg'])
  assert.equal(card.progress?.resumePath, '/oppskrift/Salat/kok?dag=1')
  assert.equal(otherCooking(card, session, recipes), null)
})

test('titler slås sammen med komma og «og»', () => {
  assert.equal(joinTitles(['A']), 'A')
  assert.equal(joinTitles(['A', 'B', 'C']), 'A, B og C')
})

test('kokeøkten er fersk i 12 timer', () => {
  const now = 1_000_000_000_000
  assert.equal(isRecentCookingSession({ recipeId: 'r', stepIndex: 0, savedAt: now - 1000 }, now), true)
  assert.equal(
    isRecentCookingSession({ recipeId: 'r', stepIndex: 0, savedAt: now - COOKING_SESSION_MAX_AGE_MS - 1 }, now),
    false
  )
  assert.equal(isRecentCookingSession({ recipeId: 'r', stepIndex: 0 }, now), false)
  assert.equal(isRecentCookingSession(null, now), false)
})
