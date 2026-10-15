import { supabase } from './supabaseClient'

export {
  aggregateIngredients,
  applyOverrides,
  ingredientKey,
  removeAlwaysHome,
  removeCleared,
} from './shoppingAggregate.ts'
export type { AggregatedIngredient, ItemOverride, ShoppingRow } from './shoppingAggregate.ts'
import type { ItemOverride } from './shoppingAggregate.ts'

// shopping_item_overrides kommer fra migration_handleliste_redigering.sql.
// Til den er kjørt skal handlelisten og "Ny ukesmeny" virke som før.
export function isMissingTable(error: { code?: string }): boolean {
  return error.code === 'PGRST205' || error.code === '42P01'
}

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

export async function addManualItem(familyId: string | null, name: string): Promise<string> {
  const userId = await currentUserId()
  const { data, error } = await supabase
    .from('manual_shopping_items')
    .insert({ family_id: familyId, owner_id: userId, name: name.trim() })
    .select('id')
    .single()
  if (error) throw error
  return data.id
}

export async function deleteManualItem(id: string): Promise<void> {
  const { error } = await supabase.from('manual_shopping_items').delete().eq('id', id)
  if (error) throw error
}

export async function renameManualItem(id: string, name: string): Promise<void> {
  const { error } = await supabase.from('manual_shopping_items').update({ name: name.trim() }).eq('id', id)
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

export async function listOverrides(familyId: string | null): Promise<ItemOverride[]> {
  const query = supabase.from('shopping_item_overrides').select('normalized_name, unit, name, amount_text')
  const { data, error } = familyId
    ? await query.eq('family_id', familyId)
    : await query.is('family_id', null).eq('owner_id', await currentUserId())
  if (error) {
    if (isMissingTable(error)) return []
    throw error
  }
  return data ?? []
}

// Erstatter overstyringen for en vare fra ukens retter. Begge felt NULL
// fjerner den, så varen går tilbake til det utregnede.
export async function saveOverride(
  familyId: string | null,
  normalizedName: string,
  unit: string,
  name: string | null,
  amountText: string | null
): Promise<void> {
  const userId = await currentUserId()
  const del = supabase
    .from('shopping_item_overrides')
    .delete()
    .eq('normalized_name', normalizedName)
    .eq('unit', unit)
  const { error: deleteError } = familyId
    ? await del.eq('family_id', familyId)
    : await del.is('family_id', null).eq('owner_id', userId)
  if (deleteError) throw deleteError
  if (name === null && amountText === null) return
  const { error } = await supabase.from('shopping_item_overrides').insert({
    family_id: familyId,
    owner_id: userId,
    normalized_name: normalizedName,
    unit,
    name,
    amount_text: amountText,
  })
  if (error) throw error
}
