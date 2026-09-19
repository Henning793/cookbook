import { supabase } from './supabaseClient'

export { aggregateIngredients, ingredientKey, removeAlwaysHome } from './shoppingAggregate.ts'
export type { AggregatedIngredient } from './shoppingAggregate.ts'

async function currentUserId(): Promise<string> {
  const { data } = await supabase.auth.getUser()
  const userId = data.user?.id
  if (!userId) throw new Error('Ikke innlogget.')
  return userId
}

export interface CheckedItem {
  normalized_name: string
  unit: string
}

export async function listCheckedItems(familyId: string | null): Promise<CheckedItem[]> {
  const query = supabase.from('shopping_checked_items').select('normalized_name, unit')
  const { data, error } = familyId
    ? await query.eq('family_id', familyId)
    : await query.is('family_id', null).eq('owner_id', await currentUserId())
  if (error) throw error
  return data ?? []
}

export async function setItemChecked(
  familyId: string | null,
  normalizedName: string,
  unit: string
): Promise<void> {
  const userId = await currentUserId()
  const { error } = await supabase
    .from('shopping_checked_items')
    .insert({ family_id: familyId, owner_id: userId, normalized_name: normalizedName, unit })
  if (error) throw error
}

export async function setItemUnchecked(
  familyId: string | null,
  normalizedName: string,
  unit: string
): Promise<void> {
  const query = supabase
    .from('shopping_checked_items')
    .delete()
    .eq('normalized_name', normalizedName)
    .eq('unit', unit)
  const { error } = familyId
    ? await query.eq('family_id', familyId)
    : await query.is('family_id', null).eq('owner_id', await currentUserId())
  if (error) throw error
}

export async function clearCheckedItems(familyId: string | null): Promise<void> {
  const query = supabase.from('shopping_checked_items').delete()
  const { error } = familyId
    ? await query.eq('family_id', familyId)
    : await query.is('family_id', null).eq('owner_id', await currentUserId())
  if (error) throw error
}

export interface ManualItem {
  id: string
  name: string
}

export async function listManualItems(familyId: string | null): Promise<ManualItem[]> {
  const query = supabase.from('manual_shopping_items').select('id, name').order('created_at', { ascending: true })
  const { data, error } = familyId
    ? await query.eq('family_id', familyId)
    : await query.is('family_id', null).eq('owner_id', await currentUserId())
  if (error) throw error
  return data ?? []
}

export async function addManualItem(familyId: string | null, name: string): Promise<void> {
  const userId = await currentUserId()
  const { error } = await supabase
    .from('manual_shopping_items')
    .insert({ family_id: familyId, owner_id: userId, name: name.trim() })
  if (error) throw error
}

export async function removeManualItem(id: string): Promise<void> {
  const { error } = await supabase.from('manual_shopping_items').delete().eq('id', id)
  if (error) throw error
}

// Kun brukt ved overgang personlig -> familie (se FamiliePage) — vanlig
// resetMenu (src/lib/menuDays.ts) rører ALDRI Egne varer, men her forkastes
// hele det personlige scopet, inkludert Egne varer, fordi de ikke gir
// mening å blande inn i familiens liste.
export async function deleteAllManualItems(familyId: string | null): Promise<void> {
  const query = supabase.from('manual_shopping_items').delete()
  const { error } = familyId
    ? await query.eq('family_id', familyId)
    : await query.is('family_id', null).eq('owner_id', await currentUserId())
  if (error) throw error
}
