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
