import { supabase } from './supabaseClient'
import type { FamilyShare, ShareLinkPreview, ShareType } from '../types'

export async function createShareLink(
  shareType: ShareType,
  recipeId: string | null,
  collectionId: string | null
): Promise<string> {
  const { data, error } = await supabase.rpc('create_share_link', {
    p_share_type: shareType,
    p_recipe_id: recipeId,
    p_collection_id: collectionId,
  })
  if (error) throw error
  return data as string
}

/** null = lenken er ugyldig eller utløpt. */
export async function getShareLinkPreview(token: string): Promise<ShareLinkPreview | null> {
  const { data, error } = await supabase.rpc('share_link_preview', { p_token: token })
  if (error) throw error
  return (data as ShareLinkPreview[] | null)?.[0] ?? null
}

export async function acceptShareLink(token: string): Promise<string> {
  const { data, error } = await supabase.rpc('accept_share_link', { p_token: token })
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
