import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search } from 'lucide-react'
import { useApp } from '../context/AppContext'
import type { Recipe } from '../types'

interface Match {
  text: string
  index: number
}

function findMatch(recipe: Recipe, query: string): Match | null {
  const lowerQuery = query.toLowerCase()

  const titleIndex = recipe.title.toLowerCase().indexOf(lowerQuery)
  if (titleIndex !== -1) {
    return { text: recipe.title, index: titleIndex }
  }

  for (const ingredient of recipe.ingredients) {
    const index = ingredient.name.toLowerCase().indexOf(lowerQuery)
    if (index !== -1) {
      return { text: ingredient.name, index }
    }
  }

  for (const step of recipe.steps) {
    const index = step.toLowerCase().indexOf(lowerQuery)
    if (index !== -1) {
      return { text: step, index }
    }
  }

  return null
}

function buildSnippet(match: Match, queryLength: number) {
  const { text, index } = match
  const start = Math.max(0, index - 30)
  const end = Math.min(text.length, index + queryLength + 30)

  return {
    prefix: (start > 0 ? '…' : '') + text.slice(start, index),
    highlight: text.slice(index, index + queryLength),
    suffix: text.slice(index + queryLength, end) + (end < text.length ? '…' : ''),
  }
}

export function SokPage() {
  const navigate = useNavigate()
  const { recipes, profiles, availableTags, filters, setFilters } = useApp()

  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  useEffect(() => {
    const timeout = setTimeout(() => setDebouncedQuery(query), 150)
    return () => clearTimeout(timeout)
  }, [query])

  const trimmedQuery = debouncedQuery.trim()

  const matches = useMemo(() => {
    if (trimmedQuery === '') return []
    return recipes
      .map((recipe) => ({ recipe, match: findMatch(recipe, trimmedQuery) }))
      .filter((entry): entry is { recipe: Recipe; match: Match } => entry.match !== null)
  }, [recipes, trimmedQuery])

  const results = useMemo(
    () =>
      matches.filter(
        ({ recipe }) =>
          (filters.ownerId === null || recipe.owner_id === filters.ownerId) &&
          (filters.tag === null || recipe.tags.includes(filters.tag))
      ),
    [matches, filters]
  )

  return (
    <div className="page sok-page">
      <nav className="nav-bar">
        <button type="button" className="nav-link" onClick={() => navigate('/')}>
          ‹ Kokeboka
        </button>
      </nav>

      <div className="search-field search-field-focused">
        <Search size={13} strokeWidth={2.75} aria-hidden="true" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={`Søk i ${recipes.length} oppskrifter`}
        />
      </div>

      <div className="sok-chips">
        {availableTags.map((tag) => (
          <button
            key={tag}
            type="button"
            className={
              filters.tag === tag ? 'sok-chip sok-chip-active-accent' : 'sok-chip'
            }
            onClick={() => setFilters({ tag: filters.tag === tag ? null : tag })}
          >
            {tag}
          </button>
        ))}
        {profiles.map((profile) => (
          <button
            key={profile.id}
            type="button"
            className={
              filters.ownerId === profile.id ? 'sok-chip sok-chip-active-sage' : 'sok-chip'
            }
            onClick={() =>
              setFilters({ ownerId: filters.ownerId === profile.id ? null : profile.id })
            }
          >
            {profile.display_name}
          </button>
        ))}
        <button type="button" className="sok-chip" disabled>
          Under 30 min
        </button>
        <button type="button" className="sok-chip" disabled>
          Har bilde
        </button>
      </div>

      {trimmedQuery !== '' && (
        <div className="sok-results">
          <p className="sok-results-count">{results.length} treff</p>

          {results.length === 0 ? (
            <p className="status-message">Ingen treff på &quot;{query}&quot;</p>
          ) : (
            <div className="sok-result-list">
              {results.map(({ recipe, match }) => {
                const snippet = buildSnippet(match, trimmedQuery.length)
                return (
                  <button
                    key={recipe.id}
                    type="button"
                    className="sok-card"
                    onClick={() => navigate(`/oppskrift/${recipe.id}`)}
                  >
                    <span className="sok-card-title">{recipe.title}</span>
                    <span className="sok-snippet">
                      {snippet.prefix}
                      <mark>{snippet.highlight}</mark>
                      {snippet.suffix}
                    </span>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
