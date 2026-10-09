import { useEffect, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { ChevronLeft, Pencil, Share2 } from 'lucide-react'
import { supabase } from '../lib/supabaseClient'
import { useApp } from '../context/AppContext'
import { RecipeForm, type RecipeFormValues } from '../components/RecipeForm'
import { DelTilFamilieDialog } from '../components/DelTilFamilieDialog'
import { canEditRecipe, isSharedIn } from '../lib/recipePermissions'
import { getFamilyName } from '../lib/families'
import { StepText } from '../components/StepText'
import { FROM_RECIPE_STATE } from '../lib/kokemodusExit'
import type { IngredientItem } from '../types'

function formatNumber(value: number) {
  return value.toLocaleString('nb-NO')
}

export function OppskriftPage() {
  const { id } = useParams<{ id: string }>()
  const location = useLocation()
  const navigate = useNavigate()
  const { recipes, session, reload, availableTags, loading, family, members } = useApp()

  const [editing, setEditing] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [showFamilyShareDialog, setShowFamilyShareDialog] = useState(false)

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

  const sharedIn = recipe ? isSharedIn(recipe, session?.user.id ?? '', family?.id ?? null) : false

  const [originFamilyName, setOriginFamilyName] = useState<string | null>(null)

  useEffect(() => {
    if (recipe && sharedIn && recipe.family_id) {
      getFamilyName(recipe.family_id).then(setOriginFamilyName).catch(() => setOriginFamilyName(null))
    } else {
      setOriginFamilyName(null)
    }
  }, [recipe?.id, sharedIn])

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
  const canEdit = canEditRecipe(
    recipe,
    session?.user.id ?? '',
    family?.id ?? null,
    new Set(members.map((m) => m.user_id))
  )

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
              description: recipe.description ?? null,
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

  // Knappene rundt porsjonsfeltet går i hele steg; feltet tar fortsatt desimaler.
  const currentServings = Number.isFinite(parsedTarget) && parsedTarget > 0 ? parsedTarget : baseServings
  function stepServings(delta: number) {
    setTargetServingsInput(String(Math.max(1, Math.round((currentServings + delta) * 10) / 10)))
  }

  // Mengden står først (tom når ingrediensen ikke har mengde), så navnene flukter.
  const renderIngredient = (ingredient: IngredientItem, index: number) => {
    return (
      <li key={index} className="oppskrift-ingredient-row">
        <span className="oppskrift-ingredient-amount">
          {ingredient.amount != null &&
            `${formatNumber(Math.round(ingredient.amount * scaleFactor * 10) / 10)} ${ingredient.unit}`}
        </span>
        <span>{ingredient.name}</span>
      </li>
    )
  }

  return (
    <div className="page oppskrift-page">
      <div className={`oppskrift-hero${recipe.image_url ? '' : ' oppskrift-hero-empty'}`}>
        {recipe.image_url && <img src={recipe.image_url} alt={recipe.title} />}
        <nav className="oppskrift-bar">
          <button type="button" className="pill-button pill-button-back" onClick={goBack}>
            <ChevronLeft size={15} strokeWidth={2.75} aria-hidden="true" />
            <span>{backLabel}</span>
          </button>
          <div className="oppskrift-bar-actions">
            {canEdit && recipe.family_id && family && (
              <button type="button" className="pill-button" onClick={() => setShowFamilyShareDialog(true)}>
                <Share2 size={14} strokeWidth={2.5} aria-hidden="true" />
                Del
              </button>
            )}
            {canEdit && (
              <button type="button" className="pill-button" onClick={() => setEditing(true)}>
                <Pencil size={14} strokeWidth={2.5} aria-hidden="true" />
                Endre
              </button>
            )}
          </div>
        </nav>
      </div>

      {showFamilyShareDialog && (
        <DelTilFamilieDialog
          shareType="recipe"
          recipeId={recipe.id}
          onClose={() => setShowFamilyShareDialog(false)}
        />
      )}

      <div className={`oppskrift-sheet${recipe.image_url ? '' : ' oppskrift-sheet-plain'}`}>
        {(recipe.tags.length > 0 || (sharedIn && originFamilyName)) && (
          <div className="oppskrift-tags">
            {recipe.tags.map((tag) => (
              <span key={tag} className="oppskrift-tag">
                {tag}
              </span>
            ))}
            {sharedIn && originFamilyName && (
              <span className="oppskrift-tag oppskrift-tag-origin">Fra {originFamilyName}</span>
            )}
          </div>
        )}

        <h1 className="oppskrift-heading">{recipe.title}</h1>

        {description && <p className="oppskrift-lede">{description}</p>}

        <div className="oppskrift-facts">
          {totalMinutes != null && (
            <div className="oppskrift-fact">
              <span className="oppskrift-fact-label">Tid</span>
              <span className="oppskrift-fact-value">{totalMinutes} min</span>
            </div>
          )}
          <div className="oppskrift-fact">
            <label className="oppskrift-fact-label" htmlFor="servings-adjust">
              Porsjoner
            </label>
            <span className="servings-stepper">
              <button
                type="button"
                aria-label="Færre porsjoner"
                disabled={!(currentServings > 1)}
                onClick={() => stepServings(-1)}
              >
                &minus;
              </button>
              <input
                id="servings-adjust"
                type="number"
                min="1"
                step="0.1"
                value={targetServingsInput}
                onChange={(e) => setTargetServingsInput(e.target.value)}
              />
              <button type="button" aria-label="Flere porsjoner" onClick={() => stepServings(1)}>
                +
              </button>
            </span>
          </div>
        </div>

        <button
          type="button"
          className="cta-button"
          disabled={recipe.steps.length === 0}
          onClick={() =>
            // Valgt antall porsjoner følger med inn i kokemodus, slik at mengdene der er skalert.
            navigate(
              `/oppskrift/${recipe.id}/kok` +
                (Number.isFinite(parsedTarget) && parsedTarget > 0 ? `?porsjoner=${parsedTarget}` : ''),
              { state: FROM_RECIPE_STATE }
            )
          }
        >
          Start kokemodus
        </button>

        <h2 className="oppskrift-section-heading">Ingredienser</h2>
        {recipe.ingredients.loose.length > 0 && (
          <ul className="oppskrift-ingredients">{recipe.ingredients.loose.map(renderIngredient)}</ul>
        )}
        {recipe.ingredients.components.map((component, componentIndex) => (
          <div key={componentIndex} className="oppskrift-component">
            <h3 className="oppskrift-component-name">{component.name}</h3>
            <ul className="oppskrift-ingredients">{component.ingredients.map(renderIngredient)}</ul>
          </div>
        ))}

        <h2 className="oppskrift-section-heading">Fremgangsmåte</h2>
        <ol className="oppskrift-steps">
          {recipe.steps.map((step, index) => (
            <li key={index} className="oppskrift-step-row">
              <span className="oppskrift-step-badge">{index + 1}</span>
              <span className="oppskrift-step-text">
                <StepText text={step} ingredients={recipe.ingredients} />
              </span>
            </li>
          ))}
        </ol>
      </div>
    </div>
  )
}
