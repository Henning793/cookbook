import { useEffect, useState } from 'react'
import type { CSSProperties } from 'react'
import { linkedSuggestions, recipeBaseServings, toMenuDayDishes } from '../lib/menuDishes'
import type { DraftDish, MenuDayDishes } from '../lib/menuDishes'
import type { Recipe } from '../types'

interface Props {
  title: string
  submitLabel: string
  recipes: Recipe[]
  // Dagens retter når en dag redigeres (hovedretten først), slik at
  // velgeren starter der. initialServings = null betyr antallet til første
  // oppskrift.
  initialDishes?: DraftDish[]
  initialServings?: number | null
  onSave: (dishes: MenuDayDishes) => void
  // Fritekst når dagen ellers er tom, lagres med en gang.
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

type Mode = 'list' | 'search' | 'freetext'

export function RecipePickerDialog({
  title,
  submitLabel,
  recipes,
  initialDishes = [],
  initialServings,
  onSave,
  onFreetext,
  onClear,
  onClose,
}: Props) {
  const viewportStyle = useVisibleViewport()
  const recipeById = (id: string) => recipes.find((r) => r.id === id)
  const recipeIdsOf = (list: DraftDish[]) => list.flatMap((d) => ('recipeId' in d ? [d.recipeId] : []))
  const initialFirstRecipe = recipeById(recipeIdsOf(initialDishes)[0] ?? '')
  const [dishes, setDishes] = useState<DraftDish[]>(initialDishes)
  const [servingsInput, setServingsInput] = useState(
    initialFirstRecipe ? formatServings(initialServings ?? recipeBaseServings(initialFirstRecipe)) : ''
  )
  const [mode, setMode] = useState<Mode>(initialDishes.length > 0 ? 'list' : 'search')
  // Retten som har sin egen −/+ åpen. Bare én om gangen.
  const [openDish, setOpenDish] = useState<number | null>(null)
  const [query, setQuery] = useState('')
  const [freetext, setFreetext] = useState('')
  // Fritekst-retten som redigeres, eller null for en ny.
  const [freetextIndex, setFreetextIndex] = useState<number | null>(null)

  const recipeIds = recipeIdsOf(dishes)
  const hasRecipe = recipeIds.length > 0
  const parsedServings = Number(servingsInput.replace(',', '.'))
  const servingsValid = Number.isFinite(parsedServings) && parsedServings > 0
  const firstRecipe = recipeById(recipeIds[0] ?? '')
  const shared = servingsValid ? parsedServings : firstRecipe ? recipeBaseServings(firstRecipe) : 1

  const chosenIds = new Set(recipeIds)
  const filtered = recipes.filter(
    (r) => !chosenIds.has(r.id) && r.title.toLowerCase().includes(query.trim().toLowerCase())
  )
  const suggestions = linkedSuggestions(recipeIds, recipes)

  function addDish(recipe: Recipe) {
    // Første oppskrift bestemmer hvor mange som spiser, til man endrer det.
    if (!hasRecipe) setServingsInput(formatServings(recipeBaseServings(recipe)))
    setDishes((current) => [...current, { recipeId: recipe.id, servings: null }])
    setQuery('')
    setMode('list')
  }

  function openFreetext(index: number | null) {
    const dish = index !== null ? dishes[index] : undefined
    setFreetext(dish && 'freetext' in dish ? dish.freetext : '')
    setFreetextIndex(index)
    setMode('freetext')
  }

  function submitFreetext() {
    const text = freetext.trim()
    if (!text) return
    // En tom dag med bare fritekst lagres med en gang, som før.
    if (dishes.length === 0) {
      onFreetext(text)
      return
    }
    setDishes((current) =>
      freetextIndex !== null
        ? current.map((dish, i) => (i === freetextIndex ? { freetext: text } : dish))
        : [...current, { freetext: text }]
    )
    setMode('list')
  }

  function removeDish(index: number) {
    const next = dishes.filter((_, i) => i !== index)
    setDishes(next)
    setOpenDish(null)
    if (next.length === 0) setMode('search')
  }

  function stepShared(delta: number) {
    setServingsInput(formatServings(Math.max(1, shared + delta)))
  }

  function stepDish(index: number, delta: number) {
    setDishes((current) =>
      current.map((dish, i) =>
        i === index && 'recipeId' in dish
          ? { ...dish, servings: Math.max(1, (dish.servings ?? shared) + delta) }
          : dish
      )
    )
  }

  function followShared(index: number) {
    setDishes((current) =>
      current.map((dish, i) => (i === index && 'recipeId' in dish ? { ...dish, servings: null } : dish))
    )
    setOpenDish(null)
  }

  function save() {
    if (hasRecipe && !servingsValid) return
    const result = toMenuDayDishes(dishes, shared, recipes)
    if (result) onSave(result)
  }

  return (
    <div className="del-dialog-backdrop" style={viewportStyle} onClick={onClose}>
      <div className="del-dialog-sheet recipe-picker-sheet" onClick={(e) => e.stopPropagation()}>
        <h2 className="del-dialog-title">{title}</h2>

        {mode === 'freetext' && (
          <>
            <p className="del-dialog-body">Skriv noe fritt (teller ikke med i handlelisten):</p>
            <input
              type="text"
              className="del-dialog-input"
              placeholder={dishes.length > 0 ? 'F.eks. Salat, Brød' : 'F.eks. Taco, Rester'}
              autoFocus
              value={freetext}
              onChange={(e) => setFreetext(e.target.value)}
            />
            <div className="del-dialog-actions">
              <button
                type="button"
                className="del-dialog-cancel"
                onClick={() => setMode(dishes.length > 0 ? 'list' : 'search')}
              >
                {dishes.length > 0 ? 'Tilbake' : 'Velg oppskrift'}
              </button>
              <button
                type="button"
                className="del-dialog-submit"
                disabled={!freetext.trim()}
                onClick={submitFreetext}
              >
                {dishes.length === 0 ? 'Bruk fritekst' : freetextIndex !== null ? 'Lagre' : 'Legg til'}
              </button>
            </div>
          </>
        )}

        {mode === 'search' && (
          <>
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
                  onClick={() => addDish(recipe)}
                >
                  <span className="samling-recipe-title">{recipe.title}</span>
                </button>
              ))}
            </div>
            <div className="del-dialog-actions">
              <button
                type="button"
                className="del-dialog-cancel"
                onClick={() => (dishes.length > 0 ? setMode('list') : onClose())}
              >
                {dishes.length > 0 ? 'Tilbake' : 'Avbryt'}
              </button>
            </div>
          </>
        )}

        {mode === 'list' && (
          <>
            <ul className="menu-dish-list">
              {dishes.map((dish, index) => {
                if ('freetext' in dish) {
                  return (
                    <li key={index} className="menu-dish-row">
                      <div className="menu-dish-head">
                        <button type="button" className="menu-dish-name" onClick={() => openFreetext(index)}>
                          <span className="menu-dish-title">{dish.freetext}</span>
                          <span className="menu-dish-note">Uten oppskrift</span>
                        </button>
                        <button
                          type="button"
                          className="menu-dish-remove"
                          aria-label={`Fjern ${dish.freetext}`}
                          onClick={() => removeDish(index)}
                        >
                          ×
                        </button>
                      </div>
                    </li>
                  )
                }
                const recipe = recipeById(dish.recipeId)
                // Med flere oppskrifter kan hver av dem trykkes på for å få
                // eget antall. Med bare én gjelder «hvor mange spiser».
                const fixed = recipeIds.length < 2
                const isOpen = openDish === index
                const note = recipe?.servings
                  ? `Oppskriften er for ${formatServings(recipe.servings)}`
                  : recipe
                    ? 'Oppskriften har ikke antall'
                    : ''
                return (
                  <li key={index} className={`menu-dish-row${isOpen ? ' menu-dish-row-open' : ''}`}>
                    <div className="menu-dish-head">
                      <button
                        type="button"
                        className="menu-dish-name"
                        disabled={fixed}
                        aria-expanded={fixed ? undefined : isOpen}
                        onClick={() => setOpenDish(isOpen ? null : index)}
                      >
                        <span className="menu-dish-title">{recipe?.title ?? 'Slettet oppskrift'}</span>
                        <span className="menu-dish-note">
                          {note}
                          {dish.servings !== null && !fixed && !isOpen && (
                            <span className="menu-dish-own">
                              {note ? ' · ' : ''}lages til {formatServings(dish.servings)}
                            </span>
                          )}
                        </span>
                      </button>
                      <button
                        type="button"
                        className="menu-dish-remove"
                        aria-label={`Fjern ${recipe?.title ?? 'retten'}`}
                        onClick={() => removeDish(index)}
                      >
                        ×
                      </button>
                    </div>
                    {isOpen && (
                      <div className="menu-dish-edit">
                        <span>Lag til</span>
                        <span className="servings-stepper">
                          <button
                            type="button"
                            aria-label="Færre porsjoner"
                            disabled={!((dish.servings ?? shared) > 1)}
                            onClick={() => stepDish(index, -1)}
                          >
                            &minus;
                          </button>
                          <span className="menu-dish-edit-value">{formatServings(dish.servings ?? shared)}</span>
                          <button type="button" aria-label="Flere porsjoner" onClick={() => stepDish(index, 1)}>
                            +
                          </button>
                        </span>
                        <button type="button" className="menu-dish-reset" onClick={() => followShared(index)}>
                          Som resten
                        </button>
                      </div>
                    )}
                  </li>
                )
              })}
            </ul>

            {suggestions.map((recipe) => (
              <div className="menu-dish-suggestion" key={recipe.id}>
                <span>
                  Lenket i beskrivelsen: <b>{recipe.title}</b>. Ta den med?
                </span>
                <button type="button" onClick={() => addDish(recipe)}>
                  + Ta med
                </button>
              </div>
            ))}

            <button type="button" className="menu-dish-add" onClick={() => setMode('search')}>
              + Legg til rett
            </button>

            {hasRecipe && (
            <div className="recipe-picker-servings">
              <div>
                <label className="recipe-picker-servings-label" htmlFor="picker-servings">
                  Hvor mange spiser
                </label>
                <p className="recipe-picker-servings-note">
                  {recipeIds.length > 1
                    ? 'Gjelder alle rettene'
                    : firstRecipe?.servings
                      ? `Oppskriften er for ${formatServings(firstRecipe.servings)}`
                      : 'Oppskriften har ikke antall'}
                </p>
              </div>
              <span className="servings-stepper">
                <button
                  type="button"
                  aria-label="Færre porsjoner"
                  disabled={!(shared > 1)}
                  onClick={() => stepShared(-1)}
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
                <button type="button" aria-label="Flere porsjoner" onClick={() => stepShared(1)}>
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
                disabled={dishes.length === 0 || (hasRecipe && !servingsValid)}
                onClick={save}
              >
                {submitLabel}
              </button>
            </div>
          </>
        )}

        <div className="recipe-picker-links">
          {mode !== 'freetext' && (
            <button type="button" className="nav-link" onClick={() => openFreetext(null)}>
              {dishes.length > 0 ? 'Legg til uten oppskrift' : 'Eller skriv noe fritt'}
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
