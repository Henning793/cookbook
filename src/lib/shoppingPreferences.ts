// Hver persons valg av hvor langt frem handlelisten går (se shoppingRange.ts).
// Lagres i shopping_preferences (migration_handleliste_periode.sql). Før
// migreringen er kjørt brukes standardvalget.
import { signedInUserId, supabase } from './supabaseClient'
import { isMissingTable } from './shoppingList'
import { DEFAULT_SHOPPING_RANGE, isShoppingRange, type ShoppingRange } from './shoppingRange'

export async function getShoppingRange(): Promise<ShoppingRange> {
  const userId = await signedInUserId()
  if (!userId) return DEFAULT_SHOPPING_RANGE
  const { data, error } = await supabase
    .from('shopping_preferences')
    .select('range')
    .eq('user_id', userId)
    .maybeSingle()
  if (error) {
    if (isMissingTable(error)) return DEFAULT_SHOPPING_RANGE
    throw error
  }
  return isShoppingRange(data?.range) ? data.range : DEFAULT_SHOPPING_RANGE
}

export async function setShoppingRange(range: ShoppingRange): Promise<void> {
  const userId = await signedInUserId()
  if (!userId) throw new Error('Ikke innlogget.')
  const { error } = await supabase
    .from('shopping_preferences')
    .upsert({ user_id: userId, range, updated_at: new Date().toISOString() })
  if (error) throw error
}
