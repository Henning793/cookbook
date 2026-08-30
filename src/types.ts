export interface Recipe {
  id: string
  created_at: string
  title: string
  ingredients: string
  steps: string
  image_url: string | null
  owner_id: string
}

export interface Profile {
  id: string
  display_name: string
}
