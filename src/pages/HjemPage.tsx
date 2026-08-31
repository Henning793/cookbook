import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, Plus, User } from 'lucide-react'
import { useApp } from '../context/AppContext'
import { UNTAGGED_TAG, UNTAGGED_LABEL } from '../lib/tags'

const DOT_COLORS = [
  'var(--color-accent-100)',
  'var(--color-accent-2-100)',
  'var(--color-neutral-300)',
]

function getGreeting() {
  const hour = new Date().getHours()
  if (hour < 11) return 'God morgen'
  if (hour < 17) return 'God dag'
  return 'God kveld'
}

export function HjemPage() {
  const navigate = useNavigate()
  const { session, recipes, profiles, loading, availableTags, cookingSession } = useApp()

  const name = session
    ? profiles.find((p) => p.id === session.user.id)?.display_name ?? null
    : null

  // Samme utledning som RecipeList.tsx sin tagsWithRecipes: tags fra
  // availableTags som faktisk brukes av minst én oppskrift.
  const tagsWithRecipes = useMemo(() => {
    const usedTags = new Set(recipes.flatMap((recipe) => recipe.tags))
    return availableTags.filter((tag) => usedTags.has(tag))
  }, [recipes, availableTags])

  const collections = useMemo(() => {
    const tagged = tagsWithRecipes.map((tag) => ({
      tag,
      label: tag,
      count: recipes.filter((recipe) => recipe.tags.includes(tag)).length,
    }))
    const untaggedCount = recipes.filter((recipe) => recipe.tags.length === 0).length
    return untaggedCount > 0
      ? [...tagged, { tag: UNTAGGED_TAG, label: UNTAGGED_LABEL, count: untaggedCount }]
      : tagged
  }, [tagsWithRecipes, recipes])

  const cookingRecipe = cookingSession
    ? recipes.find((recipe) => recipe.id === cookingSession.recipeId)
    : null

  const initialSource = name ?? session?.user.email ?? ''
  const initial = initialSource.charAt(0).toUpperCase()

  return (
    <div className="page hjem-page">
      <div className="hjem-header">
        <div>
          {session && (
            <p className="hjem-kicker">
              {getGreeting()}
              {name ? `, ${name}` : ''}
            </p>
          )}
          <h1 className="hjem-title">Kokeboka</h1>
        </div>
        <button
          type="button"
          className="hjem-avatar"
          aria-label="Profil"
          onClick={() => navigate('/meg')}
        >
          {session ? initial : <User size={16} strokeWidth={2.75} aria-hidden="true" />}
        </button>
      </div>

      <div className="search-field" onClick={() => navigate('/sok')}>
        <Search size={13} strokeWidth={2.75} aria-hidden="true" />
        <input
          readOnly
          type="text"
          placeholder={`Søk i ${recipes.length} oppskrifter`}
          onFocus={() => navigate('/sok')}
        />
      </div>

      {cookingSession && cookingRecipe && (
        <div className="hjem-sist-brukt">
          <p className="hjem-sist-brukt-kicker">Sist brukt</p>
          <h2 className="hjem-sist-brukt-title">{cookingRecipe.title}</h2>
          <p className="hjem-sist-brukt-meta">Du stoppet på steg {cookingSession.stepIndex + 1}</p>
          <button
            type="button"
            className="hjem-sist-brukt-cta"
            onClick={() => navigate(`/oppskrift/${cookingSession.recipeId}/kok`)}
          >
            Fortsett
          </button>
        </div>
      )}

      {loading ? (
        <p className="status-message">Laster oppskrifter...</p>
      ) : recipes.length === 0 ? (
        <p className="status-message">Ingen oppskrifter enda. Legg til den første!</p>
      ) : (
        <>
          <p className="hjem-samlinger-kicker">Samlinger</p>
          <div className="hjem-grid">
            {collections.map(({ tag, label, count }, index) => {
              const isUntagged = tag === UNTAGGED_TAG
              return (
                <button
                  type="button"
                  key={tag}
                  className="hjem-collection-card"
                  onClick={() => navigate(`/samling/${encodeURIComponent(tag)}`)}
                >
                  <span
                    className="hjem-collection-dot"
                    style={{
                      background: isUntagged
                        ? 'var(--color-neutral-400)'
                        : DOT_COLORS[index % DOT_COLORS.length],
                    }}
                    aria-hidden="true"
                  />
                  <span className="hjem-collection-name">{label}</span>
                  <span className="hjem-collection-count">
                    {count} {count === 1 ? 'oppskrift' : 'oppskrifter'}
                  </span>
                </button>
              )
            })}
          </div>
        </>
      )}

      {session && (
        <button
          type="button"
          className="hjem-fab"
          aria-label="Ny oppskrift"
          onClick={() => navigate('/ny')}
        >
          <Plus size={30} strokeWidth={2.75} aria-hidden="true" />
        </button>
      )}
    </div>
  )
}
