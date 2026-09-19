import { useState } from 'react'
import type { Recipe } from '../types'

interface Props {
  recipes: Recipe[]
  onPick: (recipeId: string) => void
  onFreetext: (text: string) => void
  onClear?: () => void
  onClose: () => void
}

export function RecipePickerDialog({ recipes, onPick, onFreetext, onClear, onClose }: Props) {
  const [query, setQuery] = useState('')
  const [freetext, setFreetext] = useState('')

  const filtered = recipes.filter((r) => r.title.toLowerCase().includes(query.trim().toLowerCase()))

  return (
    <div className="del-dialog-backdrop" onClick={onClose}>
      <div className="del-dialog-sheet" onClick={(e) => e.stopPropagation()}>
        <h2 className="del-dialog-title">Velg for dagen</h2>
        <input
          type="text"
          className="del-dialog-input"
          placeholder="Søk etter oppskrift"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <div className="recipe-picker-list">
          {filtered.map((recipe) => (
            <button
              type="button"
              key={recipe.id}
              className="samling-recipe-row"
              onClick={() => onPick(recipe.id)}
            >
              <span className="samling-recipe-title">{recipe.title}</span>
            </button>
          ))}
        </div>
        <p className="del-dialog-body">Eller skriv noe fritt (teller ikke med i handlelisten):</p>
        <input
          type="text"
          className="del-dialog-input"
          placeholder="F.eks. Taco, Rester"
          value={freetext}
          onChange={(e) => setFreetext(e.target.value)}
        />
        <div className="del-dialog-actions">
          <button type="button" className="del-dialog-cancel" onClick={onClose}>
            Avbryt
          </button>
          <button
            type="button"
            className="del-dialog-submit"
            disabled={!freetext.trim()}
            onClick={() => freetext.trim() && onFreetext(freetext.trim())}
          >
            Bruk fritekst
          </button>
        </div>
        {onClear && (
          <button type="button" className="familie-leave-button" onClick={onClear}>
            Tøm dagen
          </button>
        )}
      </div>
    </div>
  )
}
