import type { IngredientItem } from '../types'

export interface ImportedRecipe {
  title: string
  ingredients: IngredientItem[]
  steps: string[]
}

export async function importRecipeFromUrl(url: string): Promise<ImportedRecipe> {
  let response: Response
  try {
    response = await fetch(`/.netlify/functions/import-recipe?url=${encodeURIComponent(url)}`)
  } catch {
    throw new Error('Klarte ikke å koble til. Sjekk nettforbindelsen og prøv igjen.')
  }

  let data: { error?: string } & Partial<ImportedRecipe>
  try {
    data = await response.json()
  } catch {
    throw new Error('Fikk et uventet svar. Prøv igjen om litt.')
  }

  if (!response.ok) {
    throw new Error(data.error ?? 'Klarte ikke å importere oppskriften')
  }

  return data as ImportedRecipe
}
