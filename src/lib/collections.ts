import { supabase } from './supabaseClient'
import type { Collection } from '../types'

export async function getCollection(id: string): Promise<Collection | null> {
  const { data, error } = await supabase.from('collections').select('*').eq('id', id).maybeSingle()
  if (error) throw error
  return data
}

// Familiens samlinger når familyId er satt, ellers den innloggede brukerens
// egne personlige samlinger (family_id NULL, scopet på created_by).
export async function listCollections(familyId: string | null): Promise<Collection[]> {
  if (familyId) {
    const { data, error } = await supabase
      .from('collections')
      .select('*')
      .eq('family_id', familyId)
      .order('name', { ascending: true })
    if (error) throw error
    return data ?? []
  }

  const { data: userData } = await supabase.auth.getUser()
  const userId = userData.user?.id
  if (!userId) return []

  const { data, error } = await supabase
    .from('collections')
    .select('*')
    .is('family_id', null)
    .eq('created_by', userId)
    .order('name', { ascending: true })
  if (error) throw error
  return data ?? []
}

export async function listRecipeIdsInCollection(collectionId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('collection_recipes')
    .select('recipe_id')
    .eq('collection_id', collectionId)
  if (error) throw error
  return (data ?? []).map((row) => row.recipe_id)
}
