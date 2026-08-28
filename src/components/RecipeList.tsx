import type { Recipe } from '../types'

interface Props {
  recipes: Recipe[]
  loading: boolean
}

export function RecipeList({ recipes, loading }: Props) {
  if (loading) {
    return <p className="status-message">Laster oppskrifter...</p>
  }

  if (recipes.length === 0) {
    return <p className="status-message">Ingen oppskrifter enda. Legg til den første!</p>
  }

  return (
    <div className="recipe-grid">
      {recipes.map((recipe) => (
        <details key={recipe.id} className="recipe-card">
          <summary>
            {recipe.image_url && (
              <img src={recipe.image_url} alt={recipe.title} loading="lazy" />
            )}
            <span className="recipe-title">{recipe.title}</span>
          </summary>
          <div className="recipe-body">
            <h3>Ingredienser</h3>
            <p className="preformatted">{recipe.ingredients}</p>
            <h3>Fremgangsmåte</h3>
            <p className="preformatted">{recipe.steps}</p>
          </div>
        </details>
      ))}
    </div>
  )
}
