import { supabase } from './supabaseClient'
import type { Collection } from '../types'

export async function getCollection(id: string): Promise<Collection | null> {
  const { data, error } = await supabase.from('collections').select('*').eq('id', id).maybeSingle()
  if (error) throw error
  return data
}

export async function listCollections(familyId: string): Promise<Collection[]> {
  const { data, error } = await supabase
    .from('collections')
    .select('*')
    .eq('family_id', familyId)
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
