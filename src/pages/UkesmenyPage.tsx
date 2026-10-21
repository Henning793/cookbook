import { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { ChevronLeft, ChevronRight, Ellipsis } from 'lucide-react'
import { useApp } from '../context/AppContext'
import {
  listMenuDays,
  setMenuDayDishes,
  setMenuDayFreetext,
  clearMenuDay,
  clearMenuWeek,
  swapMenuDays,
} from '../lib/menuDays'
import { currentWeekStart, addWeeks, parseWeekParam, weekNumber, weekRangeLabel, dayDate, isPastDay, isoWeekday } from '../lib/menuWeeks'
import { CopyWeekDialog } from '../components/CopyWeekDialog'
import { cachedMenuDays } from '../lib/menuCache'
import { isEmptyDay, swapDaysLocal, swapMessage } from '../lib/menuSwap'
import { useLongPressSwap } from '../components/useLongPressSwap'
import { errorMessage } from '../lib/errorMessage'
import { addWeeklyItemsToShoppingList } from '../lib/standingItems'
import { RecipePickerDialog } from '../components/RecipePickerDialog'
import { draftDishes, menuDayItems } from '../lib/menuDishes'
import type { MenuDayDishes, PlannedDish } from '../lib/menuDishes'
import { Login } from '../components/Login'
import { FROM_MENU_STATE, menuRecipePath } from '../lib/menuServings'
import { WEEKDAY_NAMES, dayPath } from '../lib/dayCooking'
import type { MenuDay } from '../types'

const WEEKDAY_LABELS = ['Man', 'Tir', 'Ons', 'Tor', 'Fre', 'Lør', 'Søn']

export function UkesmenyPage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const { session, family, familyLoading, recipes } = useApp()
  const thisWeek = currentWeekStart()
  // Uken som vises ligger i URL-en (?uke=mandag), så tilbake fra en oppskrift
  // havner i samme uke. Uten ?uke vises denne uken.
  const week = parseWeekParam(searchParams.get('uke')) ?? thisWeek
  const isThisWeek = week === thisWeek
  // Starter med uken fra mellomlageret når familien alt er kjent, så første
  // tegning ikke viser «Laster».
  const initial = familyLoading ? undefined : cachedMenuDays(family?.id ?? null, week)
  const [days, setDays] = useState<MenuDay[]>(initial ?? [])
  // Uken dagene i days hører til; null før første lasting.
  const [loadedWeek, setLoadedWeek] = useState<string | null>(initial ? week : null)
  const loading = loadedWeek !== week
  const shownWeek = useRef(week)
  useEffect(() => {
    shownWeek.current = week
  }, [week])
  const [editingWeekday, setEditingWeekday] = useState<number | null>(null)
  const [showConfirm, setShowConfirm] = useState(false)
  const [showMenu, setShowMenu] = useState(false)
  const [showCopy, setShowCopy] = useState(false)
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
    let cancelled = false
    // Viser sist hentede dager for uken med en gang (også det forsiden
    // hentet), så siden åpner uten «Laster» og ikke blinker når man blar.
    const cached = cachedMenuDays(familyId, week)
    if (cached) {
      setDays(cached)
      setLoadedWeek(week)
    }
    listMenuDays(familyId, week).then((rows) => {
      if (cancelled) return
      setDays(rows)
      setLoadedWeek(week)
    })
    return () => {
      cancelled = true
    }
  }, [familyId, familyLoading, week])

  // Blar med replace, så tilbake-knappen ikke går gjennom alle ukene.
  function goToWeek(next: string) {
    setNotice(null)
    setSearchParams(next === thisWeek ? {} : { uke: next }, { replace: true })
  }

  function dayFor(weekday: number): MenuDay | undefined {
    return days.find((d) => d.weekday === weekday)
  }

  async function reload() {
    // Uken kan ha blitt byttet mens et bytte ble lagret i bakgrunnen.
    const rows = await listMenuDays(familyId, week)
    if (shownWeek.current === week) setDays(rows)
  }

  async function handlePick(dishes: MenuDayDishes) {
    if (editingWeekday === null) return
    setBusy(true)
    try {
      await setMenuDayDishes(familyId, week, editingWeekday, dishes)
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
      await setMenuDayFreetext(familyId, week, editingWeekday, text)
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
      await clearMenuDay(familyId, week, editingWeekday)
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
      .then(() => swapMenuDays(familyId, week, from, to))
      .catch((err) => showNotice(`Kunne ikke bytte: ${errorMessage(err)}`, null))
      .finally(() => {
        pendingSaves.current -= 1
        if (pendingSaves.current === 0) reload().catch(() => {})
      })
  }

  const swap = useLongPressSwap(!busy && editingWeekday === null, (from, to) => handleSwap(from, to))

  // Å tømme denne uken tømmer også handlelisten og legger til faste kjøp,
  // som «Ny ukesmeny» gjorde før. Andre uker tømmer bare dagene.
  async function handleClearWeek() {
    setBusy(true)
    try {
      await clearMenuWeek(familyId, week)
      if (isThisWeek) await addWeeklyItemsToShoppingList(familyId)
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
        {loadedWeek !== null && (
          <div className="ukesmeny-more">
            <button
              type="button"
              className="ukesmeny-more-button"
              aria-label="Flere valg for uken"
              aria-expanded={showMenu}
              onClick={() => setShowMenu((open) => !open)}
            >
              <Ellipsis size={20} aria-hidden="true" />
            </button>
            {showMenu && (
              <>
                <div className="ukesmeny-more-backdrop" onClick={() => setShowMenu(false)} />
                <div className="ukesmeny-more-menu" role="menu">
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setShowMenu(false)
                      setShowCopy(true)
                    }}
                  >
                    Kopier uken til …
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    className="ukesmeny-more-danger"
                    onClick={() => {
                      setShowMenu(false)
                      setShowConfirm(true)
                    }}
                  >
                    Tøm uken
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </nav>

      <h1 className="oppskrift-title">Ukesmeny</h1>

      <div className="ukesmeny-weekbar">
        <button type="button" className="ukesmeny-weekbar-arrow" aria-label="Forrige uke" onClick={() => goToWeek(addWeeks(week, -1))}>
          <ChevronLeft size={18} strokeWidth={2.5} aria-hidden="true" />
        </button>
        <div className="ukesmeny-weekbar-label" aria-live="polite">
          <span className="ukesmeny-weekbar-week">
            Uke {weekNumber(week)}
            {isThisWeek && <span className="ukesmeny-weekbar-now">Nå</span>}
          </span>
          <span className="ukesmeny-weekbar-dates">{weekRangeLabel(week)}</span>
        </div>
        <button type="button" className="ukesmeny-weekbar-arrow" aria-label="Neste uke" onClick={() => goToWeek(addWeeks(week, 1))}>
          <ChevronRight size={18} strokeWidth={2.5} aria-hidden="true" />
        </button>
      </div>
      {!isThisWeek && (
        <button type="button" className="ukesmeny-back-to-now" onClick={() => goToWeek(thisWeek)}>
          {week < thisWeek ? 'Til denne uken →' : '← Til denne uken'}
        </button>
      )}

      {loading ? (
        <p className="status-message">Laster ukesmeny...</p>
      ) : (
        <div className="ukesmeny-days">
          {WEEKDAY_LABELS.map((abbr, weekday) => {
            const day = dayFor(weekday)
            const label = (
              <>
                {abbr}
                <span className="ukesmeny-day-date">{dayDate(week, weekday).getDate()}.</span>
              </>
            )
            const swapClasses = [
              isPastDay(week, weekday) ? 'ukesmeny-day-past' : '',
              isThisWeek && weekday === isoWeekday(new Date()) ? 'ukesmeny-day-today' : '',
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
            const [main, ...sides] = menuDayItems(day, recipes)
            // Merkelappen vises bare når antallet er endret fra oppskriftens eget.
            const mainDish = main?.dish ?? null
            const customServings =
              day.servings != null && (mainDish && !mainDish.own ? mainDish.servings !== mainDish.base : true)
                ? day.servings
                : null
            // Med to eller flere oppskrifter åpner hele dagen dagssiden. Den
            // (og kokemodus for dagen) gjelder denne uken; i andre uker åpnes
            // hver oppskrift for seg.
            const openDay =
              isThisWeek && [main, ...sides].filter((item) => item?.dish).length >= 2
                ? () => navigate(dayPath(weekday), { state: FROM_MENU_STATE })
                : undefined
            // Ellers åpnes oppskriften med antallet retten skal lages til, når
            // det er et annet enn oppskriftens eget.
            const openDish = (dish: PlannedDish) =>
              openDay
                ? openDay()
                : navigate(menuRecipePath(dish.recipe.id, dish.servings !== dish.base ? dish.servings : null), {
                    state: FROM_MENU_STATE,
                  })
            const servingsChip = customServings !== null && (
              <span className={`ukesmeny-day-servings${sides.length > 0 ? ' ukesmeny-day-servings-multi' : ''}`}>
                {customServings.toLocaleString('nb-NO')} {customServings === 1 ? 'porsjon' : 'porsjoner'}
              </span>
            )
            return (
              <div
                className={`ukesmeny-day ukesmeny-day-swappable${sides.length > 0 ? ' ukesmeny-day-multi' : ''} ${swapClasses}`}
                key={weekday}
                data-swap-day={weekday}
                onPointerDown={(e) => swap.onPointerDown(e, weekday)}
                onContextMenu={(e) => e.preventDefault()}
              >
                <div className="ukesmeny-day-dishes">
                  {mainDish ? (
                    <button type="button" className="ukesmeny-day-main" onClick={() => openDish(mainDish)}>
                      <span className="ukesmeny-day-abbr">{label}</span>
                      <span className="ukesmeny-day-title">
                        {main.title}
                        {mainDish.own && (
                          <span className="ukesmeny-day-side-own"> · {mainDish.servings.toLocaleString('nb-NO')}</span>
                        )}
                        {sides.length === 0 && servingsChip}
                      </span>
                    </button>
                  ) : (
                    <div
                      className={`ukesmeny-day-main ukesmeny-day-main-static${openDay ? ' ukesmeny-day-opens-day' : ''}`}
                      onClick={openDay}
                    >
                      <span className="ukesmeny-day-abbr">{label}</span>
                      <span className="ukesmeny-day-title">{main?.title ?? 'Slettet oppskrift'}</span>
                      {main && <span className="ukesmeny-day-freetext-tag">fritekst</span>}
                    </div>
                  )}
                  {sides.map((item, index) =>
                    item.dish ? (
                      <button
                        type="button"
                        key={index}
                        className="ukesmeny-day-side"
                        onClick={() => item.dish && openDish(item.dish)}
                      >
                        {item.title}
                        {item.dish.own && (
                          <span className="ukesmeny-day-side-own"> · {item.dish.servings.toLocaleString('nb-NO')}</span>
                        )}
                      </button>
                    ) : (
                      <span
                        key={index}
                        className={`ukesmeny-day-side ukesmeny-day-side-static${openDay ? ' ukesmeny-day-opens-day' : ''}`}
                        onClick={openDay}
                      >
                        {item.title}
                      </span>
                    )
                  )}
                  {sides.length > 0 && servingsChip}
                </div>
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
            submitLabel={editingDay?.entry_type ? 'Lagre' : `Legg til ${dayName}`}
            recipes={recipes}
            initialDishes={draftDishes(editingDay)}
            initialServings={editingDay?.servings}
            onSave={handlePick}
            onFreetext={handleFreetext}
            onClear={editingDay?.entry_type ? handleClearDay : undefined}
            onClose={() => !busy && setEditingWeekday(null)}
          />
        )
      })()}

      {showCopy && (
        <CopyWeekDialog
          familyId={familyId}
          from={week}
          onClose={() => setShowCopy(false)}
          onCopied={(to) => {
            setShowCopy(false)
            goToWeek(to)
            showNotice(`Uke ${weekNumber(week)} er kopiert til uke ${weekNumber(to)}`, null)
          }}
        />
      )}

      {showConfirm && (
        <div className="del-dialog-backdrop" onClick={() => !busy && setShowConfirm(false)}>
          <div className="del-dialog-sheet" onClick={(e) => e.stopPropagation()}>
            <h2 className="del-dialog-title">{isThisWeek ? 'Tømme denne uken?' : `Tømme uke ${weekNumber(week)}?`}</h2>
            <p className="del-dialog-body">
              {isThisWeek
                ? 'Dette tømmer alle dagene denne uken og handlelisten. Egne varer blir stående, og faste kjøp legges til. Du kan ikke angre.'
                : `Alle dagene i uke ${weekNumber(week)} blir tomme. Du kan ikke angre.`}
            </p>
            <div className="del-dialog-actions">
              <button type="button" className="del-dialog-cancel" onClick={() => setShowConfirm(false)} disabled={busy}>
                Avbryt
              </button>
              <button type="button" className="del-dialog-submit" onClick={handleClearWeek} disabled={busy}>
                {busy ? 'Tømmer...' : 'Tøm uken'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
