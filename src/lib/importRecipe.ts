import type { IngredientItem } from '../types'

export interface ImportedRecipe {
  title: string
  ingredients: IngredientItem[]
  steps: string[]
}

export async function importRecipeFromUrl(url: string): Promise<ImportedRecipe> {
  const response = await fetch(`/.netlify/functions/import-recipe?url=${encodeURIComponent(url)}`)
  const data = await response.json()

  if (!response.ok) {
    throw new Error(data.error ?? 'Klarte ikke å importere oppskriften')
  }

  return data
}
