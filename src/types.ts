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
}

export interface Profile {
  id: string
  display_name: string
}
