import { test } from 'node:test'
import assert from 'node:assert/strict'
import { canEditRecipe, isSharedIn } from './recipePermissions.ts'
import type { Recipe } from '../types.ts'

function makeRecipe(overrides: Partial<Recipe> = {}): Recipe {
  return {
    id: 'r1',
    created_at: '2026-01-01T00:00:00Z',
    title: 'Test',
    ingredients: [],
    steps: [],
    image_url: null,
    owner_id: 'owner-1',
    family_id: 'family-a',
    tags: [],
    ...overrides,
  }
}

test('owner can edit their own recipe in their own family', () => {
  const recipe = makeRecipe({ owner_id: 'user-1', family_id: 'family-a' })
  assert.equal(
    canEditRecipe(recipe, 'user-1', 'family-a', new Set(['user-1', 'user-2'])),
    true
  )
})

test('non-owner member cannot edit a recipe whose owner is still in the family', () => {
  const recipe = makeRecipe({ owner_id: 'user-1', family_id: 'family-a' })
  assert.equal(
    canEditRecipe(recipe, 'user-2', 'family-a', new Set(['user-1', 'user-2'])),
    false
  )
})

test('anyone in the family can edit a recipe with no owner (legacy orphan)', () => {
  const recipe = makeRecipe({ owner_id: null as unknown as string, family_id: 'family-a' })
  assert.equal(
    canEditRecipe(recipe, 'user-2', 'family-a', new Set(['user-2'])),
    true
  )
})

test('anyone in the family can edit a recipe whose owner has left the family', () => {
  const recipe = makeRecipe({ owner_id: 'former-member', family_id: 'family-a' })
  assert.equal(
    canEditRecipe(recipe, 'user-2', 'family-a', new Set(['user-2'])),
    true
  )
})

test('nobody outside the recipe family can edit it, even the owner viewing it as a shared-in item', () => {
  const recipe = makeRecipe({ owner_id: 'user-1', family_id: 'family-a' })
  assert.equal(
    canEditRecipe(recipe, 'user-1', 'family-b', new Set(['user-1'])),
    false
  )
})

test('isSharedIn is true when the recipe family differs from the current family', () => {
  const recipe = makeRecipe({ family_id: 'family-a' })
  assert.equal(isSharedIn(recipe, 'family-b'), true)
  assert.equal(isSharedIn(recipe, 'family-a'), false)
})

test('owner can edit their own personal (no-family) recipe even with no family of their own', () => {
  const recipe = makeRecipe({ owner_id: 'user-1', family_id: null })
  assert.equal(canEditRecipe(recipe, 'user-1', null, new Set()), true)
})

test('owner can still edit their own personal recipe after later joining a family', () => {
  const recipe = makeRecipe({ owner_id: 'user-1', family_id: null })
  assert.equal(canEditRecipe(recipe, 'user-1', 'family-a', new Set(['user-1'])), true)
})

test('nobody but the owner can edit a personal recipe, family membership is irrelevant', () => {
  const recipe = makeRecipe({ owner_id: 'user-1', family_id: null })
  assert.equal(canEditRecipe(recipe, 'user-2', null, new Set()), false)
})

test('a personal (no-family) recipe is never considered shared-in', () => {
  const recipe = makeRecipe({ family_id: null })
  assert.equal(isSharedIn(recipe, null), false)
  assert.equal(isSharedIn(recipe, 'family-a'), false)
})
