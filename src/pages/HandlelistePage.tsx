import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useApp } from '../context/AppContext'
import { listMenuDays } from '../lib/menuDays'
import {
  aggregateIngredients,
  removeAlwaysHome,
  ingredientKey,
  listCheckedItems,
  setItemChecked,
  setItemUnchecked,
  clearCheckedItems,
  listManualItems,
  addManualItem,
  setManualChecked,
  type AggregatedIngredient,
  type CheckedItem,
  type ManualItem,
} from '../lib/shoppingList'
import { listStandingItems } from '../lib/standingItems'
import { Login } from '../components/Login'
import type { MenuDay } from '../types'

const WEEKDAY_LABELS = ['Man', 'Tir', 'Ons', 'Tor', 'Fre', 'Lør', 'Søn']

function formatAmount(item: AggregatedIngredient): string {
  if (item.amount === null) return item.unit
  return `${item.amount} ${item.unit}`.trim()
}

const keyFor = ingredientKey

export function HandlelistePage() {
  const navigate = useNavigate()
  const { session, family, familyLoading, recipes } = useApp()
  const familyId = family?.id ?? null

  const [menuDays, setMenuDays] = useState<MenuDay[]>([])
  const [checked, setChecked] = useState<CheckedItem[]>([])
  const [manualItems, setManualItems] = useState<ManualItem[]>([])
  const [alwaysHomeNames, setAlwaysHomeNames] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [newItemName, setNewItemName] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (familyLoading || !session) return
    Promise.all([
      listMenuDays(familyId),
      listCheckedItems(familyId),
      listManualItems(familyId),
      listStandingItems(familyId, 'always_home'),
    ]).then(
      ([days, checkedRows, manual, alwaysHome]) => {
        setMenuDays(days)
        setChecked(checkedRows)
        setManualItems(manual)
        setAlwaysHomeNames(new Set(alwaysHome.map((i) => i.normalized_name)))
        setLoading(false)
      }
    )
  }, [familyId, familyLoading])

  const aggregated = useMemo(
    () => removeAlwaysHome(aggregateIngredients(menuDays, recipes), alwaysHomeNames),
    [menuDays, recipes, alwaysHomeNames]
  )

  const checkedKeys = useMemo(
    () => new Set(checked.map((c) => keyFor(c.normalized_name, c.unit))),
    [checked]
  )

  const sortedAggregated = useMemo(() => {
    const isChecked = (item: AggregatedIngredient) => checkedKeys.has(keyFor(item.normalizedName, item.unit))
    return [...aggregated].sort((a, b) => Number(isChecked(a)) - Number(isChecked(b)))
  }, [aggregated, checkedKeys])

  const uncheckedFromRecipesCount = aggregated.filter(
    (item) => !checkedKeys.has(keyFor(item.normalizedName, item.unit))
  ).length
  const sortedManual = useMemo(
    () => [...manualItems].sort((a, b) => Number(a.checked) - Number(b.checked)),
    [manualItems]
  )
  const itemsLeft = uncheckedFromRecipesCount + manualItems.filter((m) => !m.checked).length

  const freetextDays = menuDays.filter((d) => d.entry_type === 'freetext')
  const hasCheckedItems = checked.length > 0 || manualItems.some((m) => m.checked)

  async function toggleChecked(item: AggregatedIngredient) {
    setBusy(true)
    try {
      if (checkedKeys.has(keyFor(item.normalizedName, item.unit))) {
        await setItemUnchecked(familyId, item.normalizedName, item.unit)
      } else {
        await setItemChecked(familyId, item.normalizedName, item.unit)
      }
      setChecked(await listCheckedItems(familyId))
    } finally {
      setBusy(false)
    }
  }

  async function handleClearChecked() {
    setBusy(true)
    try {
      await clearCheckedItems(familyId)
      setChecked([])
      setManualItems(await listManualItems(familyId))
    } finally {
      setBusy(false)
    }
  }

  async function handleToggleManual(item: ManualItem) {
    setBusy(true)
    try {
      await setManualChecked(item.id, !item.checked)
      setManualItems(await listManualItems(familyId))
    } finally {
      setBusy(false)
    }
  }

  async function handleAddManual(event: React.FormEvent) {
    event.preventDefault()
    if (!newItemName.trim()) return
    setBusy(true)
    try {
      await addManualItem(familyId, newItemName.trim())
      setManualItems(await listManualItems(familyId))
      setNewItemName('')
      setShowAdd(false)
    } finally {
      setBusy(false)
    }
  }

  if (!session) {
    return (
      <div className="page handleliste-page">
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
    <div className="page handleliste-page">
      <nav className="nav-bar">
        <button type="button" className="nav-link" onClick={() => navigate('/')}>
          <ChevronLeft size={14} strokeWidth={2.75} aria-hidden="true" />
          Kokeboka
        </button>
        {hasCheckedItems && (
          <button type="button" className="nav-link" onClick={handleClearChecked} disabled={busy}>
            Fjern avkrysset
          </button>
        )}
      </nav>

      <h1 className="oppskrift-title">Handleliste</h1>
      <button type="button" className="nav-link faste-varer-link" onClick={() => navigate('/handleliste/faste')}>
        Personaliser handlelisten
        <ChevronRight size={14} strokeWidth={2.75} aria-hidden="true" />
      </button>
      <p className="oppskrift-description">{itemsLeft} varer igjen</p>

      {loading ? (
        <p className="status-message">Laster handleliste...</p>
      ) : (
        <>
          <h2 className="section-kicker">Fra ukens retter</h2>
          {sortedAggregated.length === 0 ? (
            <p className="status-message">Ingen retter i ukesmenyen enda.</p>
          ) : (
            <div className="handleliste-rows">
              {sortedAggregated.map((item) => {
                const isChecked = checkedKeys.has(keyFor(item.normalizedName, item.unit))
                return (
                  <button
                    type="button"
                    key={keyFor(item.normalizedName, item.unit)}
                    className="handleliste-row"
                    onClick={() => toggleChecked(item)}
                    disabled={busy}
                  >
                    <span className={`handleliste-checkbox${isChecked ? ' handleliste-checkbox-checked' : ''}`} />
                    <span className={`handleliste-name${isChecked ? ' handleliste-name-checked' : ''}`}>
                      {item.displayName}
                    </span>
                    <span className="handleliste-amount">{formatAmount(item)}</span>
                  </button>
                )
              })}
            </div>
          )}

          <h2 className="section-kicker">Egne varer</h2>
          <p className="handleliste-hint">Blir stående til du trykker «Fjern avkrysset»</p>
          <div className="handleliste-rows">
            {sortedManual.map((item) => (
              <button
                type="button"
                key={item.id}
                className="handleliste-row"
                onClick={() => handleToggleManual(item)}
                disabled={busy}
              >
                <span className={`handleliste-checkbox${item.checked ? ' handleliste-checkbox-checked' : ''}`} />
                <span className={`handleliste-name${item.checked ? ' handleliste-name-checked' : ''}`}>
                  {item.name}
                </span>
              </button>
            ))}
          </div>

          {freetextDays.length > 0 && (
            <>
              <h2 className="section-kicker">Ikke dekket av handlelisten</h2>
              <div className="handleliste-freetext-list">
                {freetextDays.map((day) => (
                  <p className="handleliste-freetext-row" key={day.id}>
                    <span className="handleliste-freetext-day">{WEEKDAY_LABELS[day.weekday]}</span> · {day.freetext}
                  </p>
                ))}
              </div>
            </>
          )}
        </>
      )}

      <div className="handleliste-add-footer">
        {showAdd ? (
          <form className="handleliste-add-form" onSubmit={handleAddManual}>
            <input
              type="text"
              autoFocus
              placeholder="Vare"
              value={newItemName}
              onChange={(e) => setNewItemName(e.target.value)}
            />
            <button type="submit" className="cta-button" disabled={busy || !newItemName.trim()}>
              Legg til
            </button>
          </form>
        ) : (
          <button type="button" className="handleliste-add-pill" onClick={() => setShowAdd(true)}>
            <span className="handleliste-add-icon" aria-hidden="true">
              +
            </span>
            <span className="handleliste-add-label">Legg til vare</span>
          </button>
        )}
      </div>
    </div>
  )
}
