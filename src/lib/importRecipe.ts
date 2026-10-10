import type { IngredientItem, RecipeComponent } from '../types'

export interface ImportedRecipe {
  title: string
  // Hele ingredienslisten flatt.
  ingredients: IngredientItem[]
  // Den samme listen delt i løse ingredienser og elementer ("Marinade").
  loose: IngredientItem[]
  components: RecipeComponent[]
  steps: string[]
  servings: number | null
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

  const ingredients = data.ingredients ?? []
  return {
    title: data.title ?? '',
    ingredients,
    loose: data.loose ?? ingredients,
    components: data.components ?? [],
    steps: data.steps ?? [],
    servings: data.servings ?? null,
  }
}
