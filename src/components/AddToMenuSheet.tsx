import { useEffect, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useApp } from '../context/AppContext'
import { clearMenuDay, listMenuDays, restoreMenuDay, setMenuDayDishes } from '../lib/menuDays'
import { cachedMenuDays, lastShownWeek } from '../lib/menuCache'
import { addWeeks, currentWeekStart, dayDate, isPastDay, isoWeekday, weekNumber, weekRangeLabel } from '../lib/menuWeeks'
import { dayContent } from '../lib/menuSwap'
import { menuDayItems } from '../lib/menuDishes'
import { dayHasRecipe, startWeek, togetherWith, withRecipeAdded, withRecipeRemoved } from '../lib/menuAdd'
import { WEEKDAY_NAMES } from '../lib/dayCooking'
import { errorMessage } from '../lib/errorMessage'
import type { MenuDay, Recipe } from '../types'

const WEEKDAY_LABELS = ['Man', 'Tir', 'Ons', 'Tor', 'Fre', 'Lør', 'Søn']

interface Notice {
  text: string
  undo: (() => void) | null
}

// Ark for å legge en oppskrift i ukesmenyen fra en samling. Viser uken slik
// den ser ut i ukesmenyen; et trykk på en dag lagrer med en gang. Har dagen
// mat fra før, blir oppskriften en ekstra rett, og står den der allerede,
// fjernes den. Meldingen med «Angre» blir liggende etter at arket er lukket.
export function AddToMenuSheet({ recipe, onClose }: { recipe: Recipe | null; onClose: () => void }) {
  const { family, recipes } = useApp()
  const familyId = family?.id ?? null
  const thisWeek = currentWeekStart()
  const [week, setWeek] = useState(thisWeek)
  const [days, setDays] = useState<MenuDay[] | null>(null)
  const [chosen, setChosen] = useState<number | null>(null)
  const [notice, setNotice] = useState<Notice | null>(null)
  const noticeTimer = useRef(0)
  const closeTimer = useRef(0)

  // Nytt ark: start på uken man sist så på i ukesmenyen.
  useEffect(() => {
    if (!recipe) return
    setWeek(startWeek(lastShownWeek(), currentWeekStart()))
    setChosen(null)
  }, [recipe])

  useEffect(() => {
    if (!recipe) return
    let cancelled = false
    setDays(cachedMenuDays(familyId, week) ?? null)
    listMenuDays(familyId, week)
      .then((rows) => {
        if (!cancelled) setDays(rows)
      })
      .catch((err) => {
        if (!cancelled) showNotice(`Kunne ikke hente ukesmenyen: ${errorMessage(err)}`, null)
      })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recipe, week, familyId])

  useEffect(
    () => () => {
      window.clearTimeout(noticeTimer.current)
      window.clearTimeout(closeTimer.current)
    },
    []
  )

  function showNotice(text: string, undo: (() => void) | null) {
    window.clearTimeout(noticeTimer.current)
    setNotice({ text, undo })
    noticeTimer.current = window.setTimeout(() => setNotice(null), 5000)
  }

  function pick(weekday: number) {
    if (!recipe || !days || chosen !== null) return
    const day = days.find((d) => d.weekday === weekday)
    const has = dayHasRecipe(day, recipe.id)
    const before = dayContent(day)
    const titles = day ? menuDayItems(day, recipes).map((item) => item.title) : []
    const next = has && day ? withRecipeRemoved(day, recipe.id, recipes) : withRecipeAdded(day, recipe, recipes)
    const pickedWeek = week
    const label = `${WEEKDAY_NAMES[weekday].toLowerCase()} ${dayDate(pickedWeek, weekday).toLocaleDateString('nb-NO', {
      day: 'numeric',
      month: 'long',
    })}`

    // Lagres med en gang. Etterpå hentes uken på nytt, så ukesmenyen og
    // forsiden viser den nye retten.
    const save = (next
      ? setMenuDayDishes(familyId, pickedWeek, weekday, next)
      : clearMenuDay(familyId, pickedWeek, weekday)
    ).then(() => listMenuDays(familyId, pickedWeek))

    const undo = () => {
      setNotice(null)
      save
        .catch(() => {})
        .then(() => restoreMenuDay(familyId, pickedWeek, weekday, before))
        .then(() => listMenuDays(familyId, pickedWeek))
        .then(() => showNotice('Angret', null))
        .catch((err) => showNotice(`Kunne ikke angre: ${errorMessage(err)}`, null))
    }

    setChosen(weekday)
    showNotice(has ? `Fjernet fra ${label}` : `Lagt til ${label}${togetherWith(titles)}`, undo)
    closeTimer.current = window.setTimeout(onClose, 250)
    save.catch((err) => showNotice(`Kunne ikke lagre: ${errorMessage(err)}`, null))
  }

  const today = isoWeekday(new Date())

  return (
    <>
      {recipe && (
        <div className="del-dialog-backdrop" onClick={onClose}>
          <div
            className="del-dialog-sheet add-menu-sheet"
            role="dialog"
            aria-label={`Legg ${recipe.title} i ukesmenyen`}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="del-dialog-title">{recipe.title}</h2>

            <div className="ukesmeny-weekbar add-menu-weekbar">
              <button
                type="button"
                className="ukesmeny-weekbar-arrow"
                aria-label="Forrige uke"
                disabled={week <= thisWeek}
                onClick={() => setWeek(addWeeks(week, -1))}
              >
                <ChevronLeft size={18} strokeWidth={2.5} aria-hidden="true" />
              </button>
              <div className="ukesmeny-weekbar-label" aria-live="polite">
                <span className="ukesmeny-weekbar-week">
                  Uke {weekNumber(week)}
                  {week === thisWeek && <span className="ukesmeny-weekbar-now">Nå</span>}
                </span>
                <span className="ukesmeny-weekbar-dates">{weekRangeLabel(week)}</span>
              </div>
              <button
                type="button"
                className="ukesmeny-weekbar-arrow"
                aria-label="Neste uke"
                onClick={() => setWeek(addWeeks(week, 1))}
              >
                <ChevronRight size={18} strokeWidth={2.5} aria-hidden="true" />
              </button>
            </div>

            {days === null ? (
              <p className="status-message">Laster ukesmeny...</p>
            ) : (
              <div className="add-menu-days">
                {WEEKDAY_LABELS.map((abbr, weekday) => {
                  const day = days.find((d) => d.weekday === weekday)
                  const titles = day?.entry_type ? menuDayItems(day, recipes).map((item) => item.title) : []
                  const has = dayHasRecipe(day, recipe.id)
                  const classes = [
                    'add-menu-day',
                    titles.length === 0 ? 'add-menu-day-empty' : '',
                    isPastDay(week, weekday) ? 'ukesmeny-day-past' : '',
                    week === thisWeek && weekday === today ? 'add-menu-day-today' : '',
                    has ? 'add-menu-day-has' : '',
                    chosen === weekday ? 'add-menu-day-chosen' : '',
                  ].join(' ')
                  return (
                    <button type="button" key={weekday} className={classes} onClick={() => pick(weekday)}>
                      <span className="ukesmeny-day-abbr">
                        {abbr}
                        <span className="ukesmeny-day-date">{dayDate(week, weekday).getDate()}.</span>
                      </span>
                      <span className="add-menu-day-title">{titles.length ? titles.join(' + ') : 'Ledig'}</span>
                      <span className="add-menu-day-hint">{has ? '✓ Fjern' : titles.length ? '+ ekstra rett' : ''}</span>
                    </button>
                  )
                })}
              </div>
            )}

            <button type="button" className="add-menu-cancel" onClick={onClose}>
              Avbryt
            </button>
          </div>
        </div>
      )}

      {notice && (
        <div className="ukesmeny-notice" role="status">
          <span>{notice.text}</span>
          {notice.undo && (
            <button type="button" className="ukesmeny-notice-undo" onClick={notice.undo}>
              Angre
            </button>
          )}
        </div>
      )}
    </>
  )
}
