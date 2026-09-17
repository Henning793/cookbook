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
    .order('created_at', { ascending: false })
  if (error) throw error
  return data ?? []
}

export async function createCollection(name: string, familyId: string): Promise<Collection> {
  const { data, error } = await supabase
    .from('collections')
    .insert({ name, family_id: familyId })
    .select('*')
    .single()
  if (error) throw error
  return data
}

export async function renameCollection(id: string, name: string): Promise<void> {
  const { error } = await supabase.from('collections').update({ name }).eq('id', id)
  if (error) throw error
}

export async function deleteCollection(id: string): Promise<void> {
  const { error } = await supabase.from('collections').delete().eq('id', id)
  if (error) throw error
}

export async function listRecipeIdsInCollection(collectionId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('collection_recipes')
    .select('recipe_id')
    .eq('collection_id', collectionId)
  if (error) throw error
  return (data ?? []).map((row) => row.recipe_id)
}

export async function addRecipeToCollection(collectionId: string, recipeId: string): Promise<void> {
  const { error } = await supabase
    .from('collection_recipes')
    .insert({ collection_id: collectionId, recipe_id: recipeId })
  if (error) throw error
}

export async function removeRecipeFromCollection(collectionId: string, recipeId: string): Promise<void> {
  const { error } = await supabase
    .from('collection_recipes')
    .delete()
    .eq('collection_id', collectionId)
    .eq('recipe_id', recipeId)
  if (error) throw error
}
