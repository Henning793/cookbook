import { useState, type FormEvent } from 'react'
import type { Recipe } from '../types'

interface Props {
  weekdayName: string
  recipes: Recipe[]
  hasEntry: boolean
  busy: boolean
  onPick: (recipeId: string) => void
  onFreetext: (text: string) => void
  onClear: () => void
  onCancel: () => void
}

export function MenuDayForm({
  weekdayName,
  recipes,
  hasEntry,
  busy,
  onPick,
  onFreetext,
  onClear,
  onCancel,
}: Props) {
  const [query, setQuery] = useState('')
  const trimmed = query.trim()
  const filtered = recipes.filter((r) => r.title.toLowerCase().includes(trimmed.toLowerCase()))

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (!trimmed || busy) return
    onFreetext(trimmed)
  }

  return (
    <div className="page ukesmeny-page">
      <nav className="nav-bar">
        <button type="button" className="nav-link nav-link-muted" onClick={onCancel} disabled={busy}>
          Avbryt
        </button>
      </nav>

      <h1 className="oppskrift-title">Legg til for {weekdayName.toLowerCase()}</h1>

      <form onSubmit={handleSubmit}>
        <input
          type="text"
          autoFocus
          className="menu-day-input"
          placeholder="Skriv navn, eller søk i oppskrifter …"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </form>

      <h2 className="section-kicker menu-day-kicker">Egne oppskrifter</h2>
      <div className="samling-recipe-list">
        {trimmed && (
          <button
            type="button"
            className="samling-recipe-row menu-day-freetext-row"
            onClick={() => onFreetext(trimmed)}
            disabled={busy}
          >
            <span className="samling-recipe-title">Bruk «{trimmed}»</span>
          </button>
        )}
        {filtered.map((recipe) => (
          <button
            type="button"
            key={recipe.id}
            className="samling-recipe-row"
            onClick={() => onPick(recipe.id)}
            disabled={busy}
          >
            <span className="samling-recipe-title">{recipe.title}</span>
          </button>
        ))}
        {filtered.length === 0 && !trimmed && (
          <p className="status-message">Ingen oppskrifter enda.</p>
        )}
      </div>

      {hasEntry && (
        <button type="button" className="familie-leave-button menu-day-clear" onClick={onClear} disabled={busy}>
          Tøm dagen
        </button>
      )}
    </div>
  )
}
