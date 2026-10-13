import { useEffect, useState } from 'react'
import type { CSSProperties } from 'react'
import { recipeBaseServings } from '../lib/shoppingAggregate'
import type { Recipe } from '../types'

interface Props {
  title: string
  submitLabel: string
  recipes: Recipe[]
  // Dagens innhold når en dag redigeres, slik at velgeren starter der.
  initialRecipeId?: string | null
  initialServings?: number | null
  initialFreetext?: string | null
  // servings = null betyr oppskriftens eget antall.
  onSave: (recipeId: string, servings: number | null) => void
  onFreetext: (text: string) => void
  onClear?: () => void
  onClose: () => void
}

// Høyden og plasseringen til den synlige delen av skjermen. På Android
// legger tastaturet seg over siden uten å gjøre den mindre, så arket må
// følge visualViewport for å holde seg over tastaturet.
function visibleViewportStyle(): CSSProperties | undefined {
  const vv = window.visualViewport
  return vv ? { top: vv.offsetTop, bottom: 'auto', height: vv.height } : undefined
}

function useVisibleViewport() {
  const [style, setStyle] = useState(visibleViewportStyle)

  useEffect(() => {
    const vv = window.visualViewport
    if (!vv) return
    const update = () => setStyle(visibleViewportStyle())
    vv.addEventListener('resize', update)
    vv.addEventListener('scroll', update)
    return () => {
      vv.removeEventListener('resize', update)
      vv.removeEventListener('scroll', update)
    }
  }, [])

  return style
}

function formatServings(value: number) {
  return String(Math.round(value * 10) / 10)
}

export function RecipePickerDialog({
  title,
  submitLabel,
  recipes,
  initialRecipeId,
  initialServings,
  initialFreetext,
  onSave,
  onFreetext,
  onClear,
  onClose,
}: Props) {
  const viewportStyle = useVisibleViewport()
  const initialRecipe = recipes.find((r) => r.id === initialRecipeId)
  const [query, setQuery] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(initialRecipe?.id ?? null)
  const [servingsInput, setServingsInput] = useState(
    initialRecipe ? formatServings(initialServings ?? recipeBaseServings(initialRecipe)) : ''
  )
  const [showFreetext, setShowFreetext] = useState(!!initialFreetext)
  const [freetext, setFreetext] = useState(initialFreetext ?? '')

  const selected = recipes.find((r) => r.id === selectedId)
  const base = selected ? recipeBaseServings(selected) : 1
  const parsedServings = Number(servingsInput.replace(',', '.'))
  const servingsValid = Number.isFinite(parsedServings) && parsedServings > 0
  const currentServings = servingsValid ? parsedServings : base

  // Dagens rett øverst når en dag redigeres. Sorteres på den opprinnelige
  // retten, så listen ikke hopper når man trykker på en annen.
  const filtered = recipes
    .filter((r) => r.title.toLowerCase().includes(query.trim().toLowerCase()))
    .sort((a, b) => Number(b.id === initialRecipe?.id) - Number(a.id === initialRecipe?.id))

  function pick(recipe: Recipe) {
    // Har du endret antallet, er det like mange som skal spise selv om du
    // bytter rett. Ellers følger antallet den nye oppskriften.
    const changed = selected && servingsValid && parsedServings !== recipeBaseServings(selected)
    if (!changed) setServingsInput(formatServings(recipeBaseServings(recipe)))
    setSelectedId(recipe.id)
  }

  function stepServings(delta: number) {
    setServingsInput(formatServings(Math.max(1, currentServings + delta)))
  }

  function save() {
    if (!selected || !servingsValid) return
    onSave(selected.id, parsedServings === base ? null : parsedServings)
  }

  return (
    <div className="del-dialog-backdrop" style={viewportStyle} onClick={onClose}>
      <div className="del-dialog-sheet recipe-picker-sheet" onClick={(e) => e.stopPropagation()}>
        <h2 className="del-dialog-title">{title}</h2>

        {showFreetext ? (
          <>
            <p className="del-dialog-body">Skriv noe fritt (teller ikke med i handlelisten):</p>
            <input
              type="text"
              className="del-dialog-input"
              placeholder="F.eks. Taco, Rester"
              autoFocus
              value={freetext}
              onChange={(e) => setFreetext(e.target.value)}
            />
            <div className="del-dialog-actions">
              <button type="button" className="del-dialog-cancel" onClick={() => setShowFreetext(false)}>
                Velg oppskrift
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
          </>
        ) : (
          <>
            <input
              type="text"
              className="del-dialog-input"
              placeholder="Søk etter oppskrift"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <div className="recipe-picker-list">
              {filtered.map((recipe) => {
                const isSelected = recipe.id === selectedId
                return (
                  <button
                    type="button"
                    key={recipe.id}
                    className={`samling-recipe-row${isSelected ? ' recipe-picker-row-selected' : ''}`}
                    aria-pressed={isSelected}
                    onClick={() => pick(recipe)}
                  >
                    <span className="samling-recipe-title">{recipe.title}</span>
                    {isSelected && <span className="recipe-picker-selected-tag">valgt</span>}
                  </button>
                )
              })}
            </div>

            {selected && (
              <div className="recipe-picker-servings">
                <div>
                  <label className="recipe-picker-servings-label" htmlFor="picker-servings">
                    Porsjoner
                  </label>
                  <p className="recipe-picker-servings-note">
                    {selected.servings ? `Oppskriften er for ${formatServings(selected.servings)}` : 'Oppskriften har ikke antall'}
                  </p>
                </div>
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
                    id="picker-servings"
                    type="number"
                    min="1"
                    inputMode="decimal"
                    value={servingsInput}
                    onChange={(e) => setServingsInput(e.target.value)}
                  />
                  <button type="button" aria-label="Flere porsjoner" onClick={() => stepServings(1)}>
                    +
                  </button>
                </span>
              </div>
            )}

            <div className="del-dialog-actions">
              <button type="button" className="del-dialog-cancel" onClick={onClose}>
                Avbryt
              </button>
              <button
                type="button"
                className="del-dialog-submit"
                disabled={!selected || !servingsValid}
                onClick={save}
              >
                {submitLabel}
              </button>
            </div>

          </>
        )}

        <div className="recipe-picker-links">
          {!showFreetext && (
            <button type="button" className="nav-link" onClick={() => setShowFreetext(true)}>
              Eller skriv noe fritt
            </button>
          )}
          {onClear && (
            <button type="button" className="nav-link" onClick={onClear}>
              Tøm dagen
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
