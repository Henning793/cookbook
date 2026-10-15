import { supabase } from './supabaseClient'
import type { MenuDay } from '../types'
import { dayContent } from './menuSwap'
import type { MenuDayDishes } from './menuDishes'
import { isMissingTable } from './shoppingList'
import { currentWeekStart } from './menuWeeks'

async function currentUserId(): Promise<string> {
  const { data } = await supabase.auth.getUser()
  const userId = data.user?.id
  if (!userId) throw new Error('Ikke innlogget.')
  return userId
}

// Familiens ukesmeny når familyId er satt, ellers den innloggede brukerens
// egen personlige ukesmeny (family_id NULL, scopet på owner_id) — speiler
// listCollections i src/lib/collections.ts. week er mandagen i uken
// (standard: denne uken); null gir alle uker.
export async function listMenuDays(
  familyId: string | null,
  week: string | null = currentWeekStart()
): Promise<MenuDay[]> {
  const owner = await ownerFilter(familyId)
  const all = owner(supabase.from('menu_days').select('*'))
  const { data, error } = await (week ? all.eq('week_start', week) : all).order('weekday', { ascending: true })
  if (error) throw error
  return data ?? []
}

// Dagene i ukene fra og med from til og med to (mandager).
export async function listMenuDaysBetween(familyId: string | null, from: string, to: string): Promise<MenuDay[]> {
  const owner = await ownerFilter(familyId)
  const { data, error } = await owner(supabase.from('menu_days').select('*')).gte('week_start', from).lte('week_start', to)
  if (error) throw error
  return data ?? []
}

interface OwnerFilterable {
  eq(column: string, value: string): OwnerFilterable
  is(column: string, value: null): OwnerFilterable
}

// Filter som begrenser en spørring til familiens eller brukerens egne rader.
// Returnerer en funksjon (ikke spørringen), så den ikke kjøres av await.
async function ownerFilter(familyId: string | null): Promise<<Q>(query: Q) => Q> {
  if (familyId) return (query) => (query as OwnerFilterable).eq('family_id', familyId) as typeof query
  const userId = await currentUserId()
  return (query) => (query as OwnerFilterable).is('family_id', null).eq('owner_id', userId) as typeof query
}

async function upsertDay(
  familyId: string | null,
  week: string,
  weekday: number,
  patch: Partial<Pick<MenuDay, 'entry_type' | 'recipe_id' | 'freetext' | 'servings' | 'extra_dishes' | 'main_servings'>>
): Promise<void> {
  const userId = await currentUserId()

  // To partielle unike indekser (family_id,week_start,weekday) og (owner_id,week_start,weekday)
  // kan ikke begge målrettes med én PostgREST upsert-kall sin onConflict —
  // les-så-skriv er derfor tryggere enn å stole på onConflict-targeting mot
  // en partiell indeks.
  const existingQuery = supabase.from('menu_days').select('id')
  const { data: existing, error: findError } = familyId
    ? await existingQuery.eq('family_id', familyId).eq('week_start', week).eq('weekday', weekday).maybeSingle()
    : await existingQuery.is('family_id', null).eq('owner_id', userId).eq('week_start', week).eq('weekday', weekday).maybeSingle()
  if (findError) throw findError

  const row = {
    entry_type: null,
    recipe_id: null,
    freetext: null,
    servings: null,
    extra_dishes: [],
    main_servings: null,
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
    .insert({ family_id: familyId, owner_id: userId, week_start: week, weekday, ...row })
  if (error) throw error
}

// Hovedrett, dagens antall (null = første oppskrifts eget) og ekstra retter.
export async function setMenuDayDishes(
  familyId: string | null,
  week: string,
  weekday: number,
  dishes: MenuDayDishes
): Promise<void> {
  await upsertDay(familyId, week, weekday, dishes)
}

export async function setMenuDayFreetext(
  familyId: string | null,
  week: string,
  weekday: number,
  freetext: string
): Promise<void> {
  await upsertDay(familyId, week, weekday, { entry_type: 'freetext', freetext, recipe_id: null })
}

export async function clearMenuDay(familyId: string | null, week: string, weekday: number): Promise<void> {
  await upsertDay(familyId, week, weekday, { entry_type: null, recipe_id: null, freetext: null })
}

// Bytter innholdet (retter, fritekst og porsjoner) mellom to ukedager i samme uke. Leser
// dagene på nytt først, så et bytte bruker det som faktisk er lagret selv om
// noen andre i familien har endret menyen i mellomtiden. Å bytte samme par
// igjen angrer byttet.
export async function swapMenuDays(familyId: string | null, week: string, a: number, b: number): Promise<void> {
  if (a === b) return
  const days = await listMenuDays(familyId, week)
  const contentA = dayContent(days.find((d) => d.weekday === a))
  const contentB = dayContent(days.find((d) => d.weekday === b))
  await upsertDay(familyId, week, a, contentB)
  await upsertDay(familyId, week, b, contentA)
}

// Kopierer alle dagene i uken from til uken to. Det som lå i uken to fra før
// blir overskrevet, også dager som er tomme i from.
export async function copyMenuWeek(familyId: string | null, from: string, to: string): Promise<void> {
  if (from === to) return
  const userId = await currentUserId()
  const source = (await listMenuDays(familyId, from)).filter((d) => d.entry_type)
  await deleteMenuWeek(familyId, to)
  if (source.length === 0) return
  const { error } = await supabase.from('menu_days').insert(
    source.map((d) => ({
      family_id: familyId,
      owner_id: userId,
      week_start: to,
      weekday: d.weekday,
      ...dayContent(d),
    }))
  )
  if (error) throw error
}

async function deleteMenuWeek(familyId: string | null, week: string): Promise<void> {
  const owner = await ownerFilter(familyId)
  const { error } = await owner(supabase.from('menu_days').delete()).eq('week_start', week)
  if (error) throw error
}

// Tømmer én uke. Er det denne uken, tømmes også avkrysningene og
// redigeringene i handlelisten, som «Ny ukesmeny» gjorde før.
export async function clearMenuWeek(familyId: string | null, week: string): Promise<void> {
  if (week !== currentWeekStart()) {
    await deleteMenuWeek(familyId, week)
    return
  }
  const owner = await ownerFilter(familyId)
  const [, b, c] = await Promise.all([
    deleteMenuWeek(familyId, week),
    owner(supabase.from('shopping_checked_items').delete()),
    owner(supabase.from('shopping_item_overrides').delete()),
  ])
  if (b.error) throw b.error
  if (c.error && !isMissingTable(c.error)) throw c.error
}

// Tømmer alle ukene i ukesmenyen OG avkrysningene og redigeringene
// i "Fra ukens retter" for samme scope — men rører aldri manual_shopping_items ("Egne
// varer"), som overlever et menyreset (se src/lib/shoppingList.ts).
export async function resetMenu(familyId: string | null): Promise<void> {
  const userId = await currentUserId()
  if (familyId) {
    const [a, b, c] = await Promise.all([
      supabase.from('menu_days').delete().eq('family_id', familyId),
      supabase.from('shopping_checked_items').delete().eq('family_id', familyId),
      supabase.from('shopping_item_overrides').delete().eq('family_id', familyId),
    ])
    if (a.error) throw a.error
    if (b.error) throw b.error
    if (c.error && !isMissingTable(c.error)) throw c.error
    return
  }
  const [a, b, c] = await Promise.all([
    supabase.from('menu_days').delete().is('family_id', null).eq('owner_id', userId),
    supabase.from('shopping_checked_items').delete().is('family_id', null).eq('owner_id', userId),
    supabase.from('shopping_item_overrides').delete().is('family_id', null).eq('owner_id', userId),
  ])
  if (a.error) throw a.error
  if (b.error) throw b.error
  if (c.error && !isMissingTable(c.error)) throw c.error
}
