import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft } from 'lucide-react'
import { useApp } from '../context/AppContext'
import { listMenuDays, setMenuDayRecipe, setMenuDayFreetext, clearMenuDay, resetMenu, swapMenuDays } from '../lib/menuDays'
import { isEmptyDay, swapDaysLocal, swapMessage } from '../lib/menuSwap'
import { useLongPressSwap } from '../components/useLongPressSwap'
import { errorMessage } from '../lib/errorMessage'
import { addWeeklyItemsToShoppingList } from '../lib/standingItems'
import { RecipePickerDialog } from '../components/RecipePickerDialog'
import { recipeBaseServings } from '../lib/shoppingAggregate'
import { Login } from '../components/Login'
import type { MenuDay } from '../types'

const WEEKDAY_LABELS = ['Man', 'Tir', 'Ons', 'Tor', 'Fre', 'Lør', 'Søn']
const WEEKDAY_NAMES = ['Mandag', 'Tirsdag', 'Onsdag', 'Torsdag', 'Fredag', 'Lørdag', 'Søndag']

export function UkesmenyPage() {
  const navigate = useNavigate()
  const { session, family, familyLoading, recipes } = useApp()
  const [days, setDays] = useState<MenuDay[]>([])
  const [loading, setLoading] = useState(true)
  const [editingWeekday, setEditingWeekday] = useState<number | null>(null)
  const [showConfirm, setShowConfirm] = useState(false)
  const [busy, setBusy] = useState(false)
  // Bytter lagres etter tur i bakgrunnen, så man kan bytte videre med en
  // gang. Menyen hentes på nytt først når alle er lagret.
  const saveQueue = useRef<Promise<void>>(Promise.resolve())
  const pendingSaves = useRef(0)
  const [notice, setNotice] = useState<{ text: string; undo: [number, number] | null } | null>(null)
  const [flash, setFlash] = useState<number[]>([])
  const noticeTimer = useRef(0)

  const familyId = family?.id ?? null

  useEffect(() => {
    if (familyLoading || !session) return
    listMenuDays(familyId).then((rows) => {
      setDays(rows)
      setLoading(false)
    })
  }, [familyId, familyLoading])

  function dayFor(weekday: number): MenuDay | undefined {
    return days.find((d) => d.weekday === weekday)
  }

  async function reload() {
    setDays(await listMenuDays(familyId))
  }

  async function handlePick(recipeId: string, servings: number | null) {
    if (editingWeekday === null) return
    setBusy(true)
    try {
      await setMenuDayRecipe(familyId, editingWeekday, recipeId, servings)
      await reload()
      setEditingWeekday(null)
    } finally {
      setBusy(false)
    }
  }

  async function handleFreetext(text: string) {
    if (editingWeekday === null) return
    setBusy(true)
    try {
      await setMenuDayFreetext(familyId, editingWeekday, text)
      await reload()
      setEditingWeekday(null)
    } finally {
      setBusy(false)
    }
  }

  async function handleClearDay() {
    if (editingWeekday === null) return
    setBusy(true)
    try {
      await clearMenuDay(familyId, editingWeekday)
      await reload()
      setEditingWeekday(null)
    } finally {
      setBusy(false)
    }
  }

  function showNotice(text: string, undo: [number, number] | null) {
    window.clearTimeout(noticeTimer.current)
    setNotice({ text, undo })
    noticeTimer.current = window.setTimeout(() => setNotice(null), 5000)
  }

  useEffect(() => () => window.clearTimeout(noticeTimer.current), [])

  // Bytter to dager: vises med en gang, lagres i bakgrunnen. Å bytte samme
  // par igjen er angre.
  function handleSwap(from: number, to: number, isUndo = false) {
    const message = isUndo ? 'Byttet tilbake' : swapMessage(days, from, to)
    setDays((current) => swapDaysLocal(current, from, to))
    setFlash([from, to])
    window.setTimeout(() => setFlash([]), 1100)
    showNotice(message, isUndo ? null : [from, to])
    pendingSaves.current += 1
    saveQueue.current = saveQueue.current
      .then(() => swapMenuDays(familyId, from, to))
      .catch((err) => showNotice(`Kunne ikke bytte: ${errorMessage(err)}`, null))
      .finally(() => {
        pendingSaves.current -= 1
        if (pendingSaves.current === 0) reload().catch(() => {})
      })
  }

  const swap = useLongPressSwap(!busy && editingWeekday === null, (from, to) => handleSwap(from, to))

  async function handleResetMenu() {
    setBusy(true)
    try {
      await resetMenu(familyId)
      await addWeeklyItemsToShoppingList(familyId)
      await reload()
      setShowConfirm(false)
    } finally {
      setBusy(false)
    }
  }

  if (!session) {
    return (
      <div className="page ukesmeny-page">
        <nav className="nav-bar">
          <button type="button" className="nav-link" onClick={() => navigate('/')}>
            <ChevronLeft size={14} strokeWidth={2.75} aria-hidden="true" />
            Kokeboka
          </button>
        </nav>

        <Login />
      </div>
    )
  }

  return (
    <div className="page ukesmeny-page">
      <nav className="nav-bar">
        <button type="button" className="nav-link" onClick={() => navigate('/')}>
          <ChevronLeft size={14} strokeWidth={2.75} aria-hidden="true" />
          Kokeboka
        </button>
        {!loading && (
          <button type="button" className="nav-link" onClick={() => setShowConfirm(true)}>
            Ny ukesmeny
          </button>
        )}
      </nav>

      <h1 className="oppskrift-title">Ukesmeny</h1>

      {loading ? (
        <p className="status-message">Laster ukesmeny...</p>
      ) : (
        <div className="ukesmeny-days">
          {WEEKDAY_LABELS.map((label, weekday) => {
            const day = dayFor(weekday)
            const swapClasses = [
              swap.lifted === weekday ? 'ukesmeny-day-lifted' : '',
              swap.target === weekday ? 'ukesmeny-day-target' : '',
              flash.includes(weekday) ? 'ukesmeny-day-flash' : '',
            ].join(' ')
            const swapHint =
              swap.target === weekday ? (
                <span className="ukesmeny-day-swap-hint">{isEmptyDay(day) ? 'Flytt hit' : 'Bytt hit'}</span>
              ) : null
            if (!day || !day.entry_type) {
              return (
                <button
                  type="button"
                  key={weekday}
                  data-swap-day={weekday}
                  className={`ukesmeny-day ukesmeny-day-empty ${swapClasses}`}
                  onClick={() => setEditingWeekday(weekday)}
                >
                  <span className="ukesmeny-day-abbr">{label}</span>
                  <span className="ukesmeny-day-empty-text">Legg til oppskrift eller skriv noe</span>
                  <span aria-hidden="true">+</span>
                  {swapHint}
                </button>
              )
            }
            const isFreetext = day.entry_type === 'freetext'
            const recipe = isFreetext ? undefined : recipes.find((r) => r.id === day.recipe_id)
            // Merkelappen vises bare når antallet er endret fra oppskriftens eget.
            const customServings =
              recipe && day.servings != null && day.servings !== recipeBaseServings(recipe) ? day.servings : null
            return (
              <div
                className={`ukesmeny-day ukesmeny-day-swappable ${swapClasses}`}
                key={weekday}
                data-swap-day={weekday}
                onPointerDown={(e) => swap.onPointerDown(e, weekday)}
                onContextMenu={(e) => e.preventDefault()}
              >
                {isFreetext ? (
                  <div className="ukesmeny-day-main ukesmeny-day-main-static">
                    <span className="ukesmeny-day-abbr">{label}</span>
                    <span className="ukesmeny-day-title">{day.freetext}</span>
                    <span className="ukesmeny-day-freetext-tag">fritekst</span>
                  </div>
                ) : (
                  <button
                    type="button"
                    className="ukesmeny-day-main"
                    onClick={() => recipe && navigate(`/oppskrift/${recipe.id}`)}
                  >
                    <span className="ukesmeny-day-abbr">{label}</span>
                    <span className="ukesmeny-day-title">
                      {recipe?.title ?? 'Slettet oppskrift'}
                      {customServings !== null && (
                        <span className="ukesmeny-day-servings">
                          {customServings.toLocaleString('nb-NO')} {customServings === 1 ? 'porsjon' : 'porsjoner'}
                        </span>
                      )}
                    </span>
                  </button>
                )}
                {swapHint}
                <button
                  type="button"
                  data-swap-ignore
                  className="ukesmeny-day-edit"
                  aria-label={`Rediger ${WEEKDAY_NAMES[weekday].toLowerCase()}`}
                  onClick={() => setEditingWeekday(weekday)}
                >
                  Rediger
                </button>
              </div>
            )
          })}
        </div>
      )}

      {/* Skjules mens man drar en ny dag, så den ikke ligger i veien. */}
      {notice && swap.lifted === null && (
        <div className="ukesmeny-notice" role="status">
          <span>{notice.text}</span>
          {notice.undo && (
            <button
              type="button"
              className="ukesmeny-notice-undo"
              onClick={() => {
                const [a, b] = notice.undo!
                setNotice(null)
                handleSwap(a, b, true)
              }}
            >
              Angre
            </button>
          )}
        </div>
      )}

      {editingWeekday !== null && (() => {
        const editingDay = dayFor(editingWeekday)
        const dayName = WEEKDAY_NAMES[editingWeekday].toLowerCase()
        return (
          <RecipePickerDialog
            title={editingDay?.entry_type ? `Rediger ${dayName}` : `Velg for ${dayName}`}
            submitLabel={editingDay?.entry_type === 'recipe' ? 'Lagre' : `Legg til ${dayName}`}
            recipes={recipes}
            initialRecipeId={editingDay?.recipe_id}
            initialServings={editingDay?.servings}
            initialFreetext={editingDay?.freetext}
            onSave={handlePick}
            onFreetext={handleFreetext}
            onClear={editingDay?.entry_type ? handleClearDay : undefined}
            onClose={() => !busy && setEditingWeekday(null)}
          />
        )
      })()}

      {showConfirm && (
        <div className="del-dialog-backdrop" onClick={() => !busy && setShowConfirm(false)}>
          <div className="del-dialog-sheet" onClick={(e) => e.stopPropagation()}>
            <h2 className="del-dialog-title">Ny ukesmeny?</h2>
            <p className="del-dialog-body">
              Dette tømmer alle dagene og handlelisten. Egne varer blir stående, og faste kjøp legges til. Du kan ikke angre.
            </p>
            <div className="del-dialog-actions">
              <button type="button" className="del-dialog-cancel" onClick={() => setShowConfirm(false)} disabled={busy}>
                Avbryt
              </button>
              <button type="button" className="del-dialog-submit" onClick={handleResetMenu} disabled={busy}>
                {busy ? 'Tømmer...' : 'Tøm og start ny'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
