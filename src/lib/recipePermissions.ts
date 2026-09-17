import type { Recipe } from '../types'

// Mirrors the recipes update/delete RLS policy in supabase/migration_family_groups.sql — keep both in sync.
export function canEditRecipe(
  recipe: Recipe,
  currentUserId: string,
  currentFamilyId: string,
  familyMemberIds: Set<string>
): boolean {
  if (recipe.family_id !== currentFamilyId) return false
  if (recipe.owner_id === currentUserId) return true
  if (!recipe.owner_id) return true
  return !familyMemberIds.has(recipe.owner_id)
}

export function isSharedIn(recipe: Recipe, currentFamilyId: string): boolean {
  return recipe.family_id !== currentFamilyId
}
