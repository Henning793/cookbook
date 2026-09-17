export interface IngredientItem {
  amount: number | null
  unit: string
  name: string
  isHeading?: boolean
}

export interface Recipe {
  id: string
  created_at: string
  title: string
  ingredients: IngredientItem[]
  steps: string[]
  image_url: string | null
  owner_id: string
  family_id: string
  tags: string[]
  // Lagt til av migration_recipe_header_fields.sql (Task 7). Frem til den
  // migreringen er kjørt finnes ikke kolonnene i databasen, så disse er alltid undefined.
  description?: string
  total_minutes?: number
  servings?: number
}

export interface Profile {
  id: string
  display_name: string
}

export type FamilyRole = 'admin' | 'member'

export interface Family {
  id: string
  name: string
  invite_code: string
  created_at: string
}

export interface FamilyMember {
  family_id: string
  user_id: string
  role: FamilyRole
  joined_at: string
}

export interface Collection {
  id: string
  family_id: string
  name: string
  created_at: string
  created_by: string | null
}

export type ShareType = 'recipe' | 'collection' | 'whole_family'
export type ShareStatus = 'pending' | 'accepted' | 'rejected' | 'revoked'

export interface FamilyShare {
  id: string
  from_family_id: string
  to_family_id: string
  share_type: ShareType
  recipe_id: string | null
  collection_id: string | null
  status: ShareStatus
  created_at: string
  responded_at: string | null
}
