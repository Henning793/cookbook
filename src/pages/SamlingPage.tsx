import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams, useLocation } from 'react-router-dom'
import { ChevronLeft, Share2 } from 'lucide-react'
import { useApp } from '../context/AppContext'
import { UNTAGGED_TAG, UNTAGGED_LABEL } from '../lib/tags'
import { listRecipeIdsInCollection, getCollection } from '../lib/collections'
import { DelTilFamilieDialog } from '../components/DelTilFamilieDialog'
import { isSharedIn } from '../lib/recipePermissions'
import type { Collection } from '../types'

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
  const params = useParams<{ tag?: string; id?: string }>()
  const location = useLocation()
  const navigate = useNavigate()
  const { recipes, availableTags, loading, family } = useApp()
  const [shareCopied, setShareCopied] = useState(false)
  const [collectionRecipeIds, setCollectionRecipeIds] = useState<string[] | null>(null)
  const [showFamilyShareDialog, setShowFamilyShareDialog] = useState(false)
  const [collection, setCollection] = useState<Collection | null>(null)

  const isCollectionRoute = location.pathname.startsWith('/samlinger/')
  const collectionId = params.id

  useEffect(() => {
    if (!collectionId) return
    listRecipeIdsInCollection(collectionId).then(setCollectionRecipeIds)
    getCollection(collectionId).then(setCollection)
  }, [collectionId])

  if (isCollectionRoute) {
    const collectionRecipes = collectionRecipeIds
      ? recipes.filter((r) => collectionRecipeIds.includes(r.id))
      : []
    const isOwnCollection = !!family && !!collection && collection.family_id === family.id

    return (
      <div className="page samling-page">
        <nav className="nav-bar">
          <button type="button" className="nav-link" onClick={() => navigate('/samlinger')}>
            <ChevronLeft size={14} strokeWidth={2.75} aria-hidden="true" />
            Samlinger
          </button>
          {isOwnCollection && (
            <button type="button" className="nav-link" onClick={() => setShowFamilyShareDialog(true)}>
              <Share2 size={14} strokeWidth={2.75} aria-hidden="true" />
              Del med en familie
            </button>
          )}
        </nav>

        <h1 className="samling-title">{collection?.name ?? ''}</h1>

        {collectionRecipeIds === null || loading ? (
          <p className="status-message">Laster samling...</p>
        ) : collectionRecipes.length === 0 ? (
          <p className="status-message">Ingen oppskrifter i denne samlingen enda.</p>
        ) : (
          <div className="samling-recipe-list">
            {collectionRecipes.map((recipe) => {
              const sharedIn = family ? isSharedIn(recipe, family.id) : false
              return (
                <button
                  type="button"
                  key={recipe.id}
                  className="samling-recipe-row"
                  onClick={() => navigate(`/oppskrift/${recipe.id}`)}
                >
                  <span className="samling-recipe-title">{recipe.title}</span>
                  {sharedIn && (
                    <span
                      className="pill-tag"
                      style={{
                        background: 'var(--color-neutral-300)',
                        color: 'var(--color-neutral-800)',
                      }}
                    >
                      Delt
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        )}

        {showFamilyShareDialog && family && collectionId && (
          <DelTilFamilieDialog
            shareType="collection"
            collectionId={collectionId}
            onClose={() => setShowFamilyShareDialog(false)}
          />
        )}
      </div>
    )
  }

  const tag = params.tag ? decodeURIComponent(params.tag) : ''
  const isUntagged = tag === UNTAGGED_TAG
  const displayLabel = isUntagged ? UNTAGGED_LABEL : tag

  // Samme utledning som HjemPage sin collections-liste, slik at prikkfargen
  // for denne taggen alltid stemmer overens med Hjem sitt grid.
  const tagsWithRecipes = useMemo(() => {
    const usedTags = new Set(recipes.flatMap((recipe) => recipe.tags))
    return availableTags.filter((usedTag) => usedTags.has(usedTag))
  }, [recipes, availableTags])

  const tagIndex = tagsWithRecipes.indexOf(tag)
  const dotColor = isUntagged
    ? 'var(--color-neutral-400)'
    : DOT_COLORS[(tagIndex < 0 ? 0 : tagIndex) % DOT_COLORS.length]

  const tagRecipes = useMemo(
    () =>
      isUntagged
        ? recipes.filter((recipe) => recipe.tags.length === 0)
        : recipes.filter((recipe) => recipe.tags.includes(tag)),
    [recipes, tag, isUntagged]
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
          <ChevronLeft size={14} strokeWidth={2.75} aria-hidden="true" />
          Kokeboka
        </button>
        <button type="button" className="nav-link" onClick={copyShareLink}>
          <Share2 size={14} strokeWidth={2.75} aria-hidden="true" />
          {shareCopied ? 'Kopiert!' : 'Del'}
        </button>
      </nav>

      <div className="samling-header">
        <span className="samling-dot" style={{ background: dotColor }} aria-hidden="true" />
        <h1 className="samling-title">{displayLabel}</h1>
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
