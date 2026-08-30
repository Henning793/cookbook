import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useApp } from '../context/AppContext'

const DOT_COLORS = [
  'var(--color-accent-100)',
  'var(--color-accent-2-100)',
  'var(--color-neutral-300)',
]

const TAG_TINTS = [
  { bg: 'var(--color-accent-100)', text: 'var(--color-accent-700)' },
  { bg: 'var(--color-accent-2-100)', text: 'var(--color-accent-2-700)' },
  { bg: 'var(--color-neutral-100)', text: 'var(--color-neutral-800)' },
]

export function SamlingPage() {
  const params = useParams<{ tag: string }>()
  const navigate = useNavigate()
  const { recipes, availableTags, loading } = useApp()
  const [shareCopied, setShareCopied] = useState(false)

  const tag = params.tag ? decodeURIComponent(params.tag) : ''

  // Samme utledning som HjemPage sin collections-liste, slik at prikkfargen
  // for denne taggen alltid stemmer overens med Hjem sitt grid.
  const tagsWithRecipes = useMemo(() => {
    const usedTags = new Set(recipes.flatMap((recipe) => recipe.tags))
    return availableTags.filter((usedTag) => usedTags.has(usedTag))
  }, [recipes, availableTags])

  const tagIndex = tagsWithRecipes.indexOf(tag)
  const dotColor = DOT_COLORS[(tagIndex < 0 ? 0 : tagIndex) % DOT_COLORS.length]

  const tagRecipes = useMemo(
    () => recipes.filter((recipe) => recipe.tags.includes(tag)),
    [recipes, tag]
  )

  async function copyShareLink() {
    const url = `${window.location.origin}/samling/${encodeURIComponent(tag)}`
    try {
      await navigator.clipboard.writeText(url)
      setShareCopied(true)
      setTimeout(() => setShareCopied(false), 1500)
    } catch {
      // Utklippstavle utilgjengelig - ingen bekreftelse å vise, men ikke krasj.
    }
  }

  return (
    <div className="page samling-page">
      <nav className="nav-bar">
        <button type="button" className="nav-link" onClick={() => navigate('/')}>
          ‹ Kokeboka
        </button>
        <button type="button" className="nav-link" onClick={copyShareLink}>
          {shareCopied ? 'Kopiert!' : 'Del'}
        </button>
      </nav>

      <div className="samling-header">
        <span className="samling-dot" style={{ background: dotColor }} aria-hidden="true" />
        <h1 className="samling-title">{tag}</h1>
      </div>

      {loading ? (
        <p className="status-message">Laster oppskrifter...</p>
      ) : tagRecipes.length === 0 ? (
        <p className="status-message">Ingen oppskrifter i denne samlingen enda.</p>
      ) : (
        <div className="samling-recipe-list">
          {tagRecipes.map((recipe) => {
            const otherTag = recipe.tags.find((t) => t !== tag)
            const otherTagIndex = otherTag ? tagsWithRecipes.indexOf(otherTag) : -1
            const tint = TAG_TINTS[(otherTagIndex < 0 ? 0 : otherTagIndex) % TAG_TINTS.length]
            return (
              <button
                type="button"
                key={recipe.id}
                className="samling-recipe-row"
                onClick={() => navigate(`/oppskrift/${recipe.id}`, { state: { fromTag: tag } })}
              >
                <span className="samling-recipe-info">
                  <span className="samling-recipe-title">{recipe.title}</span>
                  {recipe.total_minutes != null && (
                    <span className="samling-recipe-meta">{recipe.total_minutes} min</span>
                  )}
                </span>
                {otherTag && (
                  <span
                    className="pill-tag"
                    style={{ background: tint.bg, color: tint.text }}
                  >
                    {otherTag}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      )}

      <div className="samling-footer">
        <button type="button" className="samling-copy-link" onClick={copyShareLink}>
          {shareCopied ? 'Kopiert!' : 'Kopier lenke til samlingen'}
        </button>
      </div>
    </div>
  )
}
