import type { Recipe } from '../types'

// Mirrors the recipes update/delete RLS policy in supabase/migration_family_groups.sql — keep both in sync.
// A recipe with family_id === null is personal (no family involved) and is
// always and only editable by its owner, regardless of the viewer's own
// current family membership - see the "family_id is null and owner_id =
// auth.uid()" branch in that policy.
export function canEditRecipe(
  recipe: Recipe,
  currentUserId: string,
  currentFamilyId: string | null,
  familyMemberIds: Set<string>
): boolean {
  if (recipe.family_id === null) return recipe.owner_id === currentUserId
  if (recipe.family_id !== currentFamilyId) return false
  if (recipe.owner_id === currentUserId) return true
  if (!recipe.owner_id) return true
  return !familyMemberIds.has(recipe.owner_id)
}

export function isSharedIn(recipe: Recipe, currentFamilyId: string | null): boolean {
  if (recipe.family_id === null) return false
  return recipe.family_id !== currentFamilyId
}
