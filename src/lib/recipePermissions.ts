import type { Recipe } from '../types'

// Mirrors the recipes update/delete RLS policy in supabase/migration_family_groups.sql — keep both in sync.
// The owner can always edit their own recipe, unconditionally - including
// a personal recipe, one in their current family, or one left behind in a
// family they've since left/switched away from. Only when the viewer is
// NOT the owner does family membership matter at all (editing someone
// else's recipe requires being in its family AND that owner no longer
// being a member there, or the recipe having no owner at all).
export function canEditRecipe(
  recipe: Recipe,
  currentUserId: string,
  currentFamilyId: string | null,
  familyMemberIds: Set<string>
): boolean {
  if (recipe.owner_id === currentUserId) return true
  if (recipe.family_id === null) return false
  if (recipe.family_id !== currentFamilyId) return false
  if (!recipe.owner_id) return true
  return !familyMemberIds.has(recipe.owner_id)
}

// "Delt inn" betyr spesifikt "jeg ser denne fordi en annen familie delte
// den med min", ikke "jeg eier denne, men den tilhører ikke lenger min
// nåværende familie" (f.eks. egne oppskrifter man skrev i en familie man
// senere har forlatt - man ser dem fortsatt, se recipes SELECT-policyen
// sin owner_id = auth.uid()-gren, men de er ikke "delt inn"). Derfor
// sjekkes eierskap først og vinner alltid over familie-sammenligningen.
export function isSharedIn(
  recipe: Recipe,
  currentUserId: string,
  currentFamilyId: string | null
): boolean {
  if (recipe.owner_id === currentUserId) return false
  if (recipe.family_id === null) return false
  return recipe.family_id !== currentFamilyId
}
