import { StepText } from './StepText'
import { allIngredients } from '../lib/recipeIngredients'
import type { IngredientItem, Recipe } from '../types'

function formatNumber(value: number) {
  return value.toLocaleString('nb-NO')
}

// Ingredienser og fremgangsmåte, skalert med scaleFactor. Brukes på
// oppskriftssiden og på dagssiden i ukesmenyen.
export function RecipeContent({ recipe, scaleFactor }: { recipe: Recipe; scaleFactor: number }) {
  const isTechnique = recipe.kind === 'technique'

  // Mengden står først (tom når ingrediensen ikke har mengde), så navnene flukter.
  const renderIngredient = (ingredient: IngredientItem, index: number) => {
    return (
      <li key={index} className="oppskrift-ingredient-row">
        <span className="oppskrift-ingredient-amount">
          {ingredient.amount != null &&
            `${formatNumber(Math.round(ingredient.amount * scaleFactor * 10) / 10)} ${ingredient.unit}`}
        </span>
        <span>{ingredient.name}</span>
      </li>
    )
  }

  return (
    <>
      {(!isTechnique || allIngredients(recipe.ingredients).length > 0) && (
        <h2 className="oppskrift-section-heading">{isTechnique ? 'Du trenger' : 'Ingredienser'}</h2>
      )}
      {recipe.ingredients.loose.length > 0 && (
        <ul className="oppskrift-ingredients">{recipe.ingredients.loose.map(renderIngredient)}</ul>
      )}
      {recipe.ingredients.components.map((component, componentIndex) => (
        <div key={componentIndex} className="oppskrift-component">
          <h3 className="oppskrift-component-name">{component.name}</h3>
          <ul className="oppskrift-ingredients">{component.ingredients.map(renderIngredient)}</ul>
        </div>
      ))}

      <h2 className="oppskrift-section-heading">Fremgangsmåte</h2>
      <ol className="oppskrift-steps">
        {recipe.steps.map((step, index) => (
          <li key={index} className="oppskrift-step-row">
            <span className="oppskrift-step-badge">{index + 1}</span>
            <span className="oppskrift-step-text">
              <StepText text={step} ingredients={recipe.ingredients} />
            </span>
          </li>
        ))}
      </ol>
    </>
  )
}
