import { supabase } from './supabaseClient'
import { listManualItems } from './shoppingList'
import { missingWeeklyItems, normalizeItemName } from './shoppingAggregate.ts'

export type StandingKind = 'always_home' | 'weekly'

export interface StandingItem {
  id: string
  name: string
  normalized_name: string
}

async function currentUserId(): Promise<string> {
  const { data } = await supabase.auth.getUser()
  const userId = data.user?.id
  if (!userId) throw new Error('Ikke innlogget.')
  return userId
}

export async function listStandingItems(
  familyId: string | null,
  kind: StandingKind
): Promise<StandingItem[]> {
  const query = supabase
    .from('standing_items')
    .select('id, name, normalized_name')
    .eq('kind', kind)
    .order('created_at', { ascending: true })
  const { data, error } = familyId
    ? await query.eq('family_id', familyId)
    : await query.is('family_id', null).eq('owner_id', await currentUserId())
  if (error) throw error
  return data ?? []
}

export async function addStandingItem(
  familyId: string | null,
  kind: StandingKind,
  name: string
): Promise<void> {
  const userId = await currentUserId()
  const { error } = await supabase.from('standing_items').insert({
    family_id: familyId,
    owner_id: userId,
    kind,
    name: name.trim(),
    normalized_name: normalizeItemName(name),
  })
  if (error) throw error
}

export async function removeStandingItem(id: string): Promise<void> {
  const { error } = await supabase.from('standing_items').delete().eq('id', id)
  if (error) throw error
}

// Kalles etter "Opprett ny ukesmeny": legger faste kjøp inn i Egne varer,
// men hopper over varer som allerede ligger der (samme normaliserte navn).
export async function addWeeklyItemsToShoppingList(familyId: string | null): Promise<void> {
  const [weekly, manual] = await Promise.all([
    listStandingItems(familyId, 'weekly'),
    listManualItems(familyId),
  ])
  const manualNames = new Set(manual.map((m) => normalizeItemName(m.name)))
  const toAdd = missingWeeklyItems(weekly, manualNames)
  if (toAdd.length === 0) return
  const userId = await currentUserId()
  const { error } = await supabase
    .from('manual_shopping_items')
    .insert(toAdd.map((item) => ({ family_id: familyId, owner_id: userId, name: item.name })))
  if (error) throw error
}

// Kun ved overgang personlig -> familie (se FamiliePage).
export async function deleteAllStandingItems(familyId: string | null): Promise<void> {
  const query = supabase.from('standing_items').delete()
  const { error } = familyId
    ? await query.eq('family_id', familyId)
    : await query.is('family_id', null).eq('owner_id', await currentUserId())
  if (error) throw error
}
