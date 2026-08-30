import { useMemo, useState } from 'react'
import type { Profile, Recipe } from '../types'

interface Props {
  recipes: Recipe[]
  profiles: Profile[]
  loading: boolean
}

export function RecipeList({ recipes, profiles, loading }: Props) {
  const [selectedOwnerId, setSelectedOwnerId] = useState<string | null>(null)

  const nameByOwnerId = useMemo(() => {
    const map = new Map<string, string>()
    for (const profile of profiles) {
      map.set(profile.id, profile.display_name)
    }
    return map
  }, [profiles])

  const ownersWithRecipes = useMemo(() => {
    const ownerIds = new Set(recipes.map((recipe) => recipe.owner_id))
    return profiles.filter((profile) => ownerIds.has(profile.id))
  }, [recipes, profiles])

  const visibleRecipes = selectedOwnerId
    ? recipes.filter((recipe) => recipe.owner_id === selectedOwnerId)
    : recipes

  if (loading) {
    return <p className="status-message">Laster oppskrifter...</p>
  }

  return (
    <>
      {ownersWithRecipes.length > 1 && (
        <div className="owner-tabs">
          <button
            className={selectedOwnerId === null ? 'owner-tab owner-tab-active' : 'owner-tab'}
            onClick={() => setSelectedOwnerId(null)}
          >
            Alle
          </button>
          {ownersWithRecipes.map((profile) => (
            <button
              key={profile.id}
              className={selectedOwnerId === profile.id ? 'owner-tab owner-tab-active' : 'owner-tab'}
              onClick={() => setSelectedOwnerId(profile.id)}
            >
              {profile.display_name}
            </button>
          ))}
        </div>
      )}

      {visibleRecipes.length === 0 ? (
        <p className="status-message">Ingen oppskrifter enda. Legg til den første!</p>
      ) : (
        <div className="recipe-grid">
          {visibleRecipes.map((recipe) => (
            <details key={recipe.id} className="recipe-card">
              <summary>
                {recipe.image_url && (
                  <img src={recipe.image_url} alt={recipe.title} loading="lazy" />
                )}
                <span className="recipe-title">{recipe.title}</span>
                <span className="owner-chip">
                  {nameByOwnerId.get(recipe.owner_id) ?? 'Ukjent'}
                </span>
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
      )}
    </>
  )
}
