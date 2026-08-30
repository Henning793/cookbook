import { useMemo, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import type { Profile, Recipe } from '../types'
import { RecipeForm, type RecipeFormValues } from './RecipeForm'

interface Props {
  recipes: Recipe[]
  profiles: Profile[]
  loading: boolean
  currentUserId: string | null
  availableTags: string[]
  onRecipeChanged: () => void
}

export function RecipeList({ recipes, profiles, loading, currentUserId, availableTags, onRecipeChanged }: Props) {
  const [selectedOwnerId, setSelectedOwnerId] = useState<string | null>(null)
  const [selectedTag, setSelectedTag] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null)

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

  const tagsWithRecipes = useMemo(() => {
    const usedTags = new Set(recipes.flatMap((recipe) => recipe.tags))
    return availableTags.filter((tag) => usedTags.has(tag))
  }, [recipes, availableTags])

  const visibleRecipes = recipes.filter(
    (recipe) =>
      (selectedOwnerId === null || recipe.owner_id === selectedOwnerId) &&
      (selectedTag === null || recipe.tags.includes(selectedTag))
  )

  async function handleUpdate(recipeId: string, values: RecipeFormValues) {
    const { error } = await supabase.from('recipes').update(values).eq('id', recipeId)
    if (error) throw error
    setEditingId(null)
    onRecipeChanged()
  }

  async function handleDelete(recipeId: string) {
    const { error } = await supabase.from('recipes').delete().eq('id', recipeId)
    if (!error) {
      setConfirmingDeleteId(null)
      setEditingId(null)
      onRecipeChanged()
    }
  }

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

      {tagsWithRecipes.length > 0 && (
        <div className="owner-tabs">
          <button
            className={selectedTag === null ? 'owner-tab owner-tab-active' : 'owner-tab'}
            onClick={() => setSelectedTag(null)}
          >
            Alle etiketter
          </button>
          {tagsWithRecipes.map((tag) => (
            <button
              key={tag}
              className={selectedTag === tag ? 'owner-tab owner-tab-active' : 'owner-tab'}
              onClick={() => setSelectedTag(tag)}
            >
              {tag}
            </button>
          ))}
        </div>
      )}

      {visibleRecipes.length === 0 ? (
        <p className="status-message">Ingen oppskrifter enda. Legg til den første!</p>
      ) : (
        <div className="recipe-grid">
          {visibleRecipes.map((recipe) => (
            <details key={recipe.id} className="recipe-card" open={editingId === recipe.id || undefined}>
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
                {editingId === recipe.id ? (
                  confirmingDeleteId === recipe.id ? (
                    <div className="delete-confirm">
                      <p>Er du sikker på at du vil slette denne oppskriften?</p>
                      <div className="form-actions">
                        <button type="button" onClick={() => setConfirmingDeleteId(null)}>
                          Avbryt
                        </button>
                        <button
                          type="button"
                          className="delete-confirm-button"
                          onClick={() => handleDelete(recipe.id)}
                        >
                          Ja, slett oppskriften
                        </button>
                      </div>
                    </div>
                  ) : (
                    <RecipeForm
                      heading="Rediger oppskrift"
                      initial={{
                        title: recipe.title,
                        ingredients: recipe.ingredients,
                        steps: recipe.steps,
                        image_url: recipe.image_url,
                        tags: recipe.tags,
                      }}
                      availableTags={availableTags}
                      submitLabel="Lagre endringer"
                      savingLabel="Lagrer..."
                      onSubmit={(values) => handleUpdate(recipe.id, values)}
                      onCancel={() => setEditingId(null)}
                      onDelete={() => setConfirmingDeleteId(recipe.id)}
                    />
                  )
                ) : (
                  <>
                    {recipe.owner_id === currentUserId && (
                      <button
                        type="button"
                        className="edit-recipe-button"
                        aria-label="Rediger oppskrift"
                        onClick={() => setEditingId(recipe.id)}
                      >
                        ✏️
                      </button>
                    )}
                    {recipe.tags.length > 0 && (
                      <div className="recipe-tags">
                        {recipe.tags.map((tag) => (
                          <span key={tag} className="tag-chip">
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                    <h3>Ingredienser</h3>
                    <ul className="ingredient-list">
                      {recipe.ingredients.map((ingredient, index) =>
                        ingredient.isHeading ? (
                          <li key={index} className="ingredient-heading">
                            {ingredient.name}
                          </li>
                        ) : (
                          <li key={index}>
                            {ingredient.amount != null && (
                              <span className="ingredient-amount-display">
                                {ingredient.amount} {ingredient.unit}
                              </span>
                            )}
                            {ingredient.name}
                          </li>
                        )
                      )}
                    </ul>
                    <h3>Fremgangsmåte</h3>
                    <ol className="step-list">
                      {recipe.steps.map((step, index) => (
                        <li key={index}>{step}</li>
                      ))}
                    </ol>
                  </>
                )}
              </div>
            </details>
          ))}
        </div>
      )}
    </>
  )
}
