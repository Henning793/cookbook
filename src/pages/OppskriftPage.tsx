import { useEffect, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { ChevronLeft, Pencil, Share2 } from 'lucide-react'
import { supabase } from '../lib/supabaseClient'
import { useApp } from '../context/AppContext'
import { RecipeForm, type RecipeFormValues } from '../components/RecipeForm'

const TAG_TINTS = [
  { bg: 'var(--color-accent-100)', text: 'var(--color-accent-700)' },
  { bg: 'var(--color-accent-2-100)', text: 'var(--color-accent-2-700)' },
  { bg: 'var(--color-neutral-100)', text: 'var(--color-neutral-800)' },
]

function formatNumber(value: number) {
  return value.toLocaleString('nb-NO')
}

export function OppskriftPage() {
  const { id } = useParams<{ id: string }>()
  const location = useLocation()
  const navigate = useNavigate()
  const { recipes, session, reload, availableTags, loading } = useApp()

  const [editing, setEditing] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [shareCopied, setShareCopied] = useState(false)

  const fromTag = (location.state as { fromTag?: string } | null)?.fromTag
  const backLabel = fromTag ?? 'Kokeboka'

  function goBack() {
    navigate(fromTag ? `/samling/${encodeURIComponent(fromTag)}` : '/')
  }

  const recipe = recipes.find((r) => r.id === id)
  const baseServings = recipe?.servings ?? 1

  // Live porsjonsjustering - ren komponent-state, lagres ikke noe sted og
  // nullstilles automatisk ved sideinnlasting. Resettes også når man
  // navigerer til en annen oppskrift uten at siden remountes.
  const [targetServingsInput, setTargetServingsInput] = useState(String(baseServings))

  useEffect(() => {
    setTargetServingsInput(String(recipe?.servings ?? 1))
  }, [recipe?.id])

  if (!recipe) {
    return (
      <div className="page oppskrift-page">
        <p className="status-message">
          {loading ? 'Laster oppskrift...' : 'Fant ikke oppskriften.'}
        </p>
      </div>
    )
  }

  const description = recipe.description ?? null
  const totalMinutes = recipe.total_minutes ?? null
  const servings = recipe.servings ?? null
  const canEdit = recipe.owner_id === session?.user.id

  const parsedTarget = Number(targetServingsInput.replace(',', '.'))
  const scaleFactor =
    Number.isFinite(parsedTarget) && parsedTarget > 0 ? parsedTarget / baseServings : 1

  async function handleUpdate(values: RecipeFormValues) {
    const { error } = await supabase.from('recipes').update(values).eq('id', recipe!.id)
    if (error) throw error
    reload()
    setEditing(false)
  }

  async function handleDelete() {
    const { error } = await supabase.from('recipes').delete().eq('id', recipe!.id)
    if (!error) {
      reload()
      navigate('/')
    }
  }

  async function handleShare() {
    const url = `${window.location.origin}/oppskrift/${recipe!.id}`
    try {
      await navigator.clipboard.writeText(url)
      setShareCopied(true)
      setTimeout(() => setShareCopied(false), 1500)
    } catch {
      // Utklippstavle utilgjengelig - ingen bekreftelse å vise, men ikke krasj.
    }
  }

  if (editing) {
    return (
      <div className="page oppskrift-page">
        <nav className="nav-bar">
          <button type="button" className="nav-link" onClick={goBack}>
            <ChevronLeft size={14} strokeWidth={2.75} aria-hidden="true" />
          {backLabel}
          </button>
        </nav>
        {confirmingDelete ? (
          <div className="delete-confirm">
            <p>Er du sikker på at du vil slette denne oppskriften?</p>
            <div className="form-actions">
              <button type="button" onClick={() => setConfirmingDelete(false)}>
                Avbryt
              </button>
              <button type="button" className="delete-confirm-button" onClick={handleDelete}>
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
              servings: recipe.servings ?? null,
            }}
            availableTags={availableTags}
            submitLabel="Lagre endringer"
            savingLabel="Lagrer..."
            onSubmit={handleUpdate}
            onCancel={() => setEditing(false)}
            onDelete={() => setConfirmingDelete(true)}
          />
        )}
      </div>
    )
  }

  return (
    <div className="page oppskrift-page">
      <nav className="nav-bar">
        <button type="button" className="nav-link" onClick={goBack}>
          <ChevronLeft size={14} strokeWidth={2.75} aria-hidden="true" />
          {backLabel}
        </button>
        <div className="nav-bar-actions">
          <button type="button" className="nav-link" onClick={handleShare}>
            <Share2 size={14} strokeWidth={2.75} aria-hidden="true" />
            {shareCopied ? 'Kopiert!' : 'Del'}
          </button>
          {canEdit && (
            <button type="button" className="nav-link" onClick={() => setEditing(true)}>
              <Pencil size={14} strokeWidth={2.75} aria-hidden="true" />
              Endre
            </button>
          )}
        </div>
      </nav>

      {recipe.image_url && (
        <div className="oppskrift-image washed">
          <img src={recipe.image_url} alt={recipe.title} />
        </div>
      )}

      <div className="tag-row">
        {recipe.tags.map((tag, index) => {
          const tint = TAG_TINTS[index % TAG_TINTS.length]
          return (
            <span key={tag} className="pill-tag" style={{ background: tint.bg, color: tint.text }}>
              {tag}
            </span>
          )
        })}
        {totalMinutes != null && (
          <span
            className="pill-tag"
            style={{ background: 'var(--color-accent-2-100)', color: 'var(--color-accent-2-700)' }}
          >
            {totalMinutes} min
          </span>
        )}
        {servings != null && (
          <span
            className="pill-tag"
            style={{ background: 'var(--color-neutral-100)', color: 'var(--color-neutral-800)' }}
          >
            {formatNumber(servings)} porsjoner
          </span>
        )}
      </div>

      <label className="servings-adjust" htmlFor="servings-adjust">
        Antall porsjoner
        <input
          id="servings-adjust"
          type="number"
          min="1"
          step="0.1"
          value={targetServingsInput}
          onChange={(e) => setTargetServingsInput(e.target.value)}
        />
      </label>

      <h1 className="oppskrift-title">{recipe.title}</h1>

      {description && <p className="oppskrift-description">{description}</p>}

      <h2 className="section-kicker">Ingredienser</h2>
      <ul className="oppskrift-ingredients">
        {recipe.ingredients.map((ingredient, index) =>
          ingredient.isHeading ? (
            <li key={index} className="oppskrift-ingredient-heading">
              {ingredient.name}
            </li>
          ) : (
            <li key={index} className="oppskrift-ingredient-row">
              <span>{ingredient.name}</span>
              {ingredient.amount != null && (
                <span className="oppskrift-ingredient-amount">
                  {formatNumber(Math.round(ingredient.amount * scaleFactor * 10) / 10)} {ingredient.unit}
                </span>
              )}
            </li>
          )
        )}
      </ul>

      <h2 className="section-kicker section-kicker-steps">Fremgangsmåte</h2>
      <ol className="oppskrift-steps">
        {recipe.steps.map((step, index) => (
          <li key={index} className="oppskrift-step-row">
            <span className="oppskrift-step-badge">{index + 1}</span>
            <span className="oppskrift-step-text">{step}</span>
          </li>
        ))}
      </ol>

      <div className="oppskrift-footer">
        <button
          type="button"
          className="cta-button"
          disabled={recipe.steps.length === 0}
          onClick={() => navigate(`/oppskrift/${recipe.id}/kok`)}
        >
          Start kokemodus
        </button>
      </div>
    </div>
  )
}
