import { supabase } from './supabaseClient'

export {
  aggregateIngredients,
  ingredientKey,
  removeAlwaysHome,
  removeCleared,
} from './shoppingAggregate.ts'
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
  cleared: boolean
}

export async function listCheckedItems(familyId: string | null): Promise<CheckedItem[]> {
  const query = supabase.from('shopping_checked_items').select('normalized_name, unit, cleared')
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

// "Fjern avkryssede": Egne varer som er huket av slettes, mens avkryssede
// oppskrift-ingredienser (regnet ut live fra ukesmenyen) markeres cleared så
// de skjules fra listen. Radene slettes ved ny ukesmeny.
export async function clearCheckedItems(familyId: string | null): Promise<void> {
  const userId = familyId ? null : await currentUserId()
  const scope = <T extends { eq: (c: string, v: string) => T; is: (c: string, v: null) => T }>(q: T) =>
    familyId ? q.eq('family_id', familyId) : q.is('family_id', null).eq('owner_id', userId!)
  const [a, b] = await Promise.all([
    scope(supabase.from('shopping_checked_items').update({ cleared: true })),
    scope(supabase.from('manual_shopping_items').delete().eq('checked', true)),
  ])
  if (a.error) throw a.error
  if (b.error) throw b.error
}

export interface ManualItem {
  id: string
  name: string
  checked: boolean
}

export async function listManualItems(familyId: string | null): Promise<ManualItem[]> {
  const query = supabase.from('manual_shopping_items').select('id, name, checked').order('created_at', { ascending: true })
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

export async function setManualChecked(id: string, checked: boolean): Promise<void> {
  const { error } = await supabase.from('manual_shopping_items').update({ checked }).eq('id', id)
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
