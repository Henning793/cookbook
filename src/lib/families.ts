import { supabase } from './supabaseClient'
import type { Family, FamilyMember } from '../types'

export async function getMyMembership(): Promise<FamilyMember | null> {
  const { data: userData } = await supabase.auth.getUser()
  const userId = userData.user?.id
  if (!userId) return null
  const { data, error } = await supabase
    .from('family_members')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle()
  if (error) throw error
  return data
}

export async function getMyFamily(familyId: string): Promise<Family | null> {
  const { data, error } = await supabase.from('families').select('*').eq('id', familyId).maybeSingle()
  if (error) throw error
  return data
}

export async function listMembers(familyId: string): Promise<FamilyMember[]> {
  const { data, error } = await supabase
    .from('family_members')
    .select('*')
    .eq('family_id', familyId)
    .order('joined_at', { ascending: true })
  if (error) throw error
  return data ?? []
}

export async function createFamily(name: string): Promise<string> {
  const { data, error } = await supabase.rpc('create_family', { p_name: name })
  if (error) throw error
  return data as string
}

export async function joinFamilyByCode(code: string): Promise<string> {
  const { data, error } = await supabase.rpc('join_family_by_code', { p_code: code })
  if (error) throw error
  return data as string
}

export async function leaveFamily(): Promise<void> {
  const { error } = await supabase.rpc('leave_family')
  if (error) throw error
}

export async function removeMember(familyId: string, userId: string): Promise<void> {
  const { error } = await supabase.rpc('remove_family_member', {
    p_family_id: familyId,
    p_user_id: userId,
  })
  if (error) throw error
}

export async function regenerateCode(familyId: string): Promise<string> {
  const { data, error } = await supabase.rpc('regenerate_family_code', { p_family_id: familyId })
  if (error) throw error
  return data as string
}

export async function getFamilyName(familyId: string): Promise<string> {
  const { data, error } = await supabase.from('families').select('name').eq('id', familyId).maybeSingle()
  if (error) throw error
  return data?.name ?? 'en annen familie'
}
