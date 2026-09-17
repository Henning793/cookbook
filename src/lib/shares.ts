import { supabase } from './supabaseClient'
import type { FamilyShare, ShareType } from '../types'

export async function startShare(
  code: string,
  shareType: ShareType,
  recipeId: string | null,
  collectionId: string | null
): Promise<string> {
  const { data, error } = await supabase.rpc('start_family_share', {
    p_code: code,
    p_share_type: shareType,
    p_recipe_id: recipeId,
    p_collection_id: collectionId,
  })
  if (error) throw error
  return data as string
}

export async function respondToShare(shareId: string, accept: boolean): Promise<void> {
  const { error } = await supabase.rpc('respond_to_family_share', {
    p_share_id: shareId,
    p_accept: accept,
  })
  if (error) throw error
}

export async function revokeShare(shareId: string): Promise<void> {
  const { error } = await supabase.rpc('revoke_family_share', { p_share_id: shareId })
  if (error) throw error
}

export async function listIncomingShares(familyId: string): Promise<FamilyShare[]> {
  const { data, error } = await supabase
    .from('family_shares')
    .select('*')
    .eq('to_family_id', familyId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data ?? []
}

export async function listOutgoingShares(familyId: string): Promise<FamilyShare[]> {
  const { data, error } = await supabase
    .from('family_shares')
    .select('*')
    .eq('from_family_id', familyId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data ?? []
}
