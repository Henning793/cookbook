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

test('a non-owner outside the recipe family cannot edit it', () => {
  const recipe = makeRecipe({ owner_id: 'user-1', family_id: 'family-a' })
  assert.equal(
    canEditRecipe(recipe, 'user-2', 'family-b', new Set(['user-2'])),
    false
  )
})

test('the owner can always edit their own recipe, even after leaving or switching to a different family', () => {
  const recipe = makeRecipe({ owner_id: 'user-1', family_id: 'family-a' })
  // Left family-a entirely (no family now).
  assert.equal(canEditRecipe(recipe, 'user-1', null, new Set()), true)
  // Joined a different family-b - still their own recipe, still editable.
  assert.equal(canEditRecipe(recipe, 'user-1', 'family-b', new Set(['user-1'])), true)
})

test('isSharedIn is true when a non-owner views a recipe from a different family', () => {
  const recipe = makeRecipe({ owner_id: 'owner-1', family_id: 'family-a' })
  assert.equal(isSharedIn(recipe, 'viewer-2', 'family-b'), true)
  assert.equal(isSharedIn(recipe, 'viewer-2', 'family-a'), false)
})

test('isSharedIn is false for the owner viewing their own recipe, even after leaving that family', () => {
  const recipe = makeRecipe({ owner_id: 'user-1', family_id: 'family-a' })
  // Still a member of family-a.
  assert.equal(isSharedIn(recipe, 'user-1', 'family-a'), false)
  // Left family-a (no family now) - still their own recipe, never "shared in".
  assert.equal(isSharedIn(recipe, 'user-1', null), false)
  // Joined a different family-b - still their own recipe, never "shared in".
  assert.equal(isSharedIn(recipe, 'user-1', 'family-b'), false)
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
  const recipe = makeRecipe({ owner_id: 'owner-1', family_id: null })
  assert.equal(isSharedIn(recipe, 'viewer-2', null), false)
  assert.equal(isSharedIn(recipe, 'viewer-2', 'family-a'), false)
})
