import { supabase } from './supabaseClient'
import type { MenuDay } from '../types'

async function currentUserId(): Promise<string> {
  const { data } = await supabase.auth.getUser()
  const userId = data.user?.id
  if (!userId) throw new Error('Ikke innlogget.')
  return userId
}

// Familiens ukesmeny når familyId er satt, ellers den innloggede brukerens
// egen personlige ukesmeny (family_id NULL, scopet på owner_id) — speiler
// listCollections i src/lib/collections.ts.
export async function listMenuDays(familyId: string | null): Promise<MenuDay[]> {
  if (familyId) {
    const { data, error } = await supabase
      .from('menu_days')
      .select('*')
      .eq('family_id', familyId)
      .order('weekday', { ascending: true })
    if (error) throw error
    return data ?? []
  }

  const userId = await currentUserId()
  const { data, error } = await supabase
    .from('menu_days')
    .select('*')
    .is('family_id', null)
    .eq('owner_id', userId)
    .order('weekday', { ascending: true })
  if (error) throw error
  return data ?? []
}

async function upsertDay(
  familyId: string | null,
  weekday: number,
  patch: Partial<Pick<MenuDay, 'entry_type' | 'recipe_id' | 'freetext'>>
): Promise<void> {
  const userId = await currentUserId()

  // To partielle unike indekser (family_id,weekday) og (owner_id,weekday)
  // kan ikke begge målrettes med én PostgREST upsert-kall sin onConflict —
  // les-så-skriv er derfor tryggere enn å stole på onConflict-targeting mot
  // en partiell indeks.
  const existingQuery = supabase.from('menu_days').select('id')
  const { data: existing, error: findError } = familyId
    ? await existingQuery.eq('family_id', familyId).eq('weekday', weekday).maybeSingle()
    : await existingQuery.is('family_id', null).eq('owner_id', userId).eq('weekday', weekday).maybeSingle()
  if (findError) throw findError

  const row = {
    entry_type: null,
    recipe_id: null,
    freetext: null,
    ...patch,
    updated_at: new Date().toISOString(),
  }

  if (existing) {
    const { error } = await supabase.from('menu_days').update(row).eq('id', existing.id)
    if (error) throw error
    return
  }

  const { error } = await supabase
    .from('menu_days')
    .insert({ family_id: familyId, owner_id: userId, weekday, ...row })
  if (error) throw error
}

export async function setMenuDayRecipe(
  familyId: string | null,
  weekday: number,
  recipeId: string
): Promise<void> {
  await upsertDay(familyId, weekday, { entry_type: 'recipe', recipe_id: recipeId, freetext: null })
}

export async function setMenuDayFreetext(
  familyId: string | null,
  weekday: number,
  freetext: string
): Promise<void> {
  await upsertDay(familyId, weekday, { entry_type: 'freetext', freetext, recipe_id: null })
}

export async function clearMenuDay(familyId: string | null, weekday: number): Promise<void> {
  await upsertDay(familyId, weekday, { entry_type: null, recipe_id: null, freetext: null })
}

// "Opprett ny ukesmeny" tømmer ukesmenyen OG avkrysningene i "Fra ukens
// retter" for samme scope — men rører aldri manual_shopping_items ("Egne
// varer"), som overlever et menyreset (se src/lib/shoppingList.ts).
export async function resetMenu(familyId: string | null): Promise<void> {
  const userId = await currentUserId()
  if (familyId) {
    const [a, b] = await Promise.all([
      supabase.from('menu_days').delete().eq('family_id', familyId),
      supabase.from('shopping_checked_items').delete().eq('family_id', familyId),
    ])
    if (a.error) throw a.error
    if (b.error) throw b.error
    return
  }
  const [a, b] = await Promise.all([
    supabase.from('menu_days').delete().is('family_id', null).eq('owner_id', userId),
    supabase.from('shopping_checked_items').delete().is('family_id', null).eq('owner_id', userId),
  ])
  if (a.error) throw a.error
  if (b.error) throw b.error
}
