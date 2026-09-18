import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft } from 'lucide-react'
import { useApp } from '../context/AppContext'
import { listMenuDays, setMenuDayRecipe, setMenuDayFreetext, clearMenuDay, resetMenu } from '../lib/menuDays'
import { RecipePickerDialog } from '../components/RecipePickerDialog'
import { Login } from '../components/Login'
import type { MenuDay } from '../types'

const WEEKDAY_LABELS = ['Man', 'Tir', 'Ons', 'Tor', 'Fre', 'Lør', 'Søn']

export function UkesmenyPage() {
  const navigate = useNavigate()
  const { session, family, familyLoading, recipes } = useApp()
  const [days, setDays] = useState<MenuDay[]>([])
  const [loading, setLoading] = useState(true)
  const [editingWeekday, setEditingWeekday] = useState<number | null>(null)
  const [showConfirm, setShowConfirm] = useState(false)
  const [busy, setBusy] = useState(false)

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

  async function handlePick(recipeId: string) {
    if (editingWeekday === null) return
    setBusy(true)
    try {
      await setMenuDayRecipe(familyId, editingWeekday, recipeId)
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

  async function handleResetMenu() {
    setBusy(true)
    try {
      await resetMenu(familyId)
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
            if (!day || !day.entry_type) {
              return (
                <button
                  type="button"
                  key={weekday}
                  className="ukesmeny-day ukesmeny-day-empty"
                  onClick={() => setEditingWeekday(weekday)}
                >
                  <span className="ukesmeny-day-abbr">{label}</span>
                  <span className="ukesmeny-day-empty-text">Legg til oppskrift eller skriv noe</span>
                  <span aria-hidden="true">+</span>
                </button>
              )
            }
            if (day.entry_type === 'freetext') {
              return (
                <button
                  type="button"
                  key={weekday}
                  className="ukesmeny-day"
                  onClick={() => setEditingWeekday(weekday)}
                >
                  <span className="ukesmeny-day-abbr">{label}</span>
                  <span className="ukesmeny-day-title">{day.freetext}</span>
                  <span className="ukesmeny-day-freetext-tag">fritekst</span>
                </button>
              )
            }
            const recipe = recipes.find((r) => r.id === day.recipe_id)
            return (
              <button
                type="button"
                key={weekday}
                className="ukesmeny-day"
                onClick={() => setEditingWeekday(weekday)}
              >
                <span className="ukesmeny-day-abbr">{label}</span>
                <span className="ukesmeny-day-title">{recipe?.title ?? 'Slettet oppskrift'}</span>
                <span className="ukesmeny-day-chevron" aria-hidden="true">
                  ›
                </span>
              </button>
            )
          })}
        </div>
      )}

      {editingWeekday !== null && (
        <RecipePickerDialog
          recipes={recipes}
          onPick={handlePick}
          onFreetext={handleFreetext}
          onClear={dayFor(editingWeekday)?.entry_type ? handleClearDay : undefined}
          onClose={() => !busy && setEditingWeekday(null)}
        />
      )}

      {showConfirm && (
        <div className="del-dialog-backdrop" onClick={() => !busy && setShowConfirm(false)}>
          <div className="del-dialog-sheet" onClick={(e) => e.stopPropagation()}>
            <h2 className="del-dialog-title">Ny ukesmeny?</h2>
            <p className="del-dialog-body">
              Dette tømmer alle dagene og handlelisten. Egne varer blir stående. Du kan ikke angre.
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
