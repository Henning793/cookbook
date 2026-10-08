import { stepDisplayText } from '../lib/recipeIngredients'
import type { RecipeIngredients } from '../types'

// Viser en stegtekst uten @-koblingene, som bare styrer "Du trenger nå" i kokemodus.
export function StepText({ text, ingredients }: { text: string; ingredients: RecipeIngredients }) {
  return <>{stepDisplayText(text, ingredients)}</>
}
