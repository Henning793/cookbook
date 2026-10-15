import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useApp } from '../context/AppContext'
import { listMenuDays } from '../lib/menuDays'
import { freetextEntries } from '../lib/menuDishes'
import {
  aggregateIngredients,
  applyOverrides,
  removeAlwaysHome,
  removeCleared,
  ingredientKey,
  listCheckedItems,
  setItemChecked,
  setItemUnchecked,
  clearCheckedItems,
  listManualItems,
  addManualItem,
  setManualChecked,
  renameManualItem,
  listOverrides,
  saveOverride,
  type CheckedItem,
  type ItemOverride,
  type ManualItem,
  type ShoppingRow,
} from '../lib/shoppingList'
import { listStandingItems } from '../lib/standingItems'
import { sortShoppingItems } from '../lib/shoppingSort'
import { Login } from '../components/Login'
import type { MenuDay } from '../types'

const WEEKDAY_LABELS = ['Man', 'Tir', 'Ons', 'Tor', 'Fre', 'Lør', 'Søn']

function formatAmount(amount: number | null, unit: string): string {
  if (amount === null) return unit
  return `${amount.toLocaleString('nb-NO')} ${unit}`.trim()
}

const keyFor = ingredientKey

// Raden som er åpen for redigering: en vare fra ukens retter (nøkkel) eller
// en egen vare (id).
type Editing = { kind: 'recipe'; key: string } | { kind: 'manual'; id: string }

export function HandlelistePage() {
  const navigate = useNavigate()
  const { session, family, familyLoading, recipes } = useApp()
  const familyId = family?.id ?? null

  const [menuDays, setMenuDays] = useState<MenuDay[]>([])
  const [checked, setChecked] = useState<CheckedItem[]>([])
  const [manualItems, setManualItems] = useState<ManualItem[]>([])
  const [overrides, setOverrides] = useState<ItemOverride[]>([])
  const [editing, setEditing] = useState<Editing | null>(null)
  const [editName, setEditName] = useState('')
  const [editAmount, setEditAmount] = useState('')
  const [alwaysHomeNames, setAlwaysHomeNames] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [newItemName, setNewItemName] = useState('')
  const [busy, setBusy] = useState(false)
  // Varer der man har trykket på mengden for å se hvilke dager den kommer fra.
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (familyLoading || !session) return
    Promise.all([
      listMenuDays(familyId),
      listCheckedItems(familyId),
      listManualItems(familyId),
      listStandingItems(familyId, 'always_home'),
      listOverrides(familyId),
    ]).then(
      ([days, checkedRows, manual, alwaysHome, overrideRows]) => {
        setMenuDays(days)
        setChecked(checkedRows)
        setManualItems(manual)
        setOverrides(overrideRows)
        setAlwaysHomeNames(new Set(alwaysHome.map((i) => i.normalized_name)))
        setLoading(false)
      }
    )
  }, [familyId, familyLoading])

  const aggregated = useMemo(() => {
    const clearedKeys = new Set(
      checked.filter((c) => c.cleared).map((c) => keyFor(c.normalized_name, c.unit))
    )
    return applyOverrides(
      removeCleared(
        removeAlwaysHome(aggregateIngredients(menuDays, recipes), alwaysHomeNames),
        clearedKeys
      ),
      overrides
    )
  }, [menuDays, recipes, alwaysHomeNames, checked, overrides])

  const checkedKeys = useMemo(
    () => new Set(checked.map((c) => keyFor(c.normalized_name, c.unit))),
    [checked]
  )

  const sortedAggregated = useMemo(() => {
    return sortShoppingItems(
      aggregated,
      (item) => item.displayName,
      (item) => checkedKeys.has(keyFor(item.normalizedName, item.unit))
    )
  }, [aggregated, checkedKeys])

  const uncheckedFromRecipesCount = aggregated.filter(
    (item) => !checkedKeys.has(keyFor(item.normalizedName, item.unit))
  ).length
  const sortedManual = useMemo(
    () => sortShoppingItems(manualItems, (item) => item.name, (item) => item.checked),
    [manualItems]
  )
  const itemsLeft = uncheckedFromRecipesCount + manualItems.filter((m) => !m.checked).length

  const freetextDays = freetextEntries(menuDays)
  const hasCheckedItems = checked.some((c) => !c.cleared) || manualItems.some((m) => m.checked)

  async function toggleChecked(item: ShoppingRow) {
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

  function toggleExpanded(key: string) {
    setExpandedKeys((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  async function handleClearChecked() {
    setBusy(true)
    try {
      await clearCheckedItems(familyId)
      setChecked(await listCheckedItems(familyId))
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

  function startEditRecipeItem(item: ShoppingRow) {
    setEditing({ kind: 'recipe', key: keyFor(item.normalizedName, item.unit) })
    setEditName(item.displayName)
    setEditAmount(item.amountText ?? formatAmount(item.amount, item.unit))
  }

  function startEditManual(item: ManualItem) {
    setEditing({ kind: 'manual', id: item.id })
    setEditName(item.name)
    setEditAmount('')
  }

  // Lagrer bare det som avviker fra det utregnede, så en vare der man
  // skriver tilbake det opprinnelige ikke blir stående som redigert.
  async function handleSaveRecipeItem(event: React.FormEvent, item: ShoppingRow) {
    event.preventDefault()
    const name = editName.trim()
    const amount = editAmount.trim()
    await saveRecipeOverride(
      item,
      name && name !== item.originalName ? name : null,
      amount && amount !== formatAmount(item.amount, item.unit) ? amount : null
    )
  }

  async function saveRecipeOverride(item: ShoppingRow, name: string | null, amountText: string | null) {
    setBusy(true)
    try {
      await saveOverride(familyId, item.normalizedName, item.unit, name, amountText)
      setOverrides(await listOverrides(familyId))
      setEditing(null)
    } finally {
      setBusy(false)
    }
  }

  async function handleSaveManual(event: React.FormEvent, item: ManualItem) {
    event.preventDefault()
    const name = editName.trim()
    if (!name) return
    setBusy(true)
    try {
      if (name !== item.name) await renameManualItem(item.id, name)
      setManualItems(await listManualItems(familyId))
      setEditing(null)
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
            Fjern avkryssede
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
                const key = keyFor(item.normalizedName, item.unit)
                const isChecked = checkedKeys.has(key)
                const isExpanded = expandedKeys.has(key)
                const isEditing = editing?.kind === 'recipe' && editing.key === key
                return (
                  <div className="handleliste-row-group" key={key}>
                    <div className="handleliste-row">
                      <button
                        type="button"
                        className="handleliste-check-button"
                        aria-label={isChecked ? `Fjern hake på ${item.displayName}` : `Huk av ${item.displayName}`}
                        aria-pressed={isChecked}
                        onClick={() => toggleChecked(item)}
                        disabled={busy}
                      >
                        <span className={`handleliste-checkbox${isChecked ? ' handleliste-checkbox-checked' : ''}`} />
                      </button>
                      <button
                        type="button"
                        className="handleliste-row-toggle"
                        aria-label={`Rediger ${item.displayName}`}
                        onClick={() => startEditRecipeItem(item)}
                      >
                        <span className={`handleliste-name${isChecked ? ' handleliste-name-checked' : ''}`}>
                          {item.displayName}
                        </span>
                      </button>
                      <button
                        type="button"
                        className={`handleliste-amount${item.scaled && !item.amountText ? ' handleliste-amount-scaled' : ''}`}
                        aria-expanded={isExpanded}
                        aria-label={`Vis hvor ${item.displayName.toLowerCase()} kommer fra`}
                        onClick={() => toggleExpanded(key)}
                      >
                        {item.amountText ?? formatAmount(item.amount, item.unit)}
                      </button>
                    </div>
                    {isEditing && (
                      <form className="handleliste-edit-form" onSubmit={(e) => handleSaveRecipeItem(e, item)}>
                        <div className="handleliste-edit-fields">
                          <label className="handleliste-edit-field">
                            <span>Vare</span>
                            <input
                              type="text"
                              autoFocus
                              value={editName}
                              onChange={(e) => setEditName(e.target.value)}
                            />
                          </label>
                          <label className="handleliste-edit-field handleliste-edit-amount">
                            <span>Mengde</span>
                            <input type="text" value={editAmount} onChange={(e) => setEditAmount(e.target.value)} />
                          </label>
                        </div>
                        {item.edited && (
                          <button
                            type="button"
                            className="link-button handleliste-edit-reset"
                            onClick={() => saveRecipeOverride(item, null, null)}
                            disabled={busy}
                          >
                            Tilbakestill til {item.originalName}, {formatAmount(item.amount, item.unit)}
                          </button>
                        )}
                        <div className="handleliste-edit-actions">
                          <button type="button" className="link-button" onClick={() => setEditing(null)}>
                            Avbryt
                          </button>
                          <button type="submit" className="cta-button" disabled={busy}>
                            Lagre
                          </button>
                        </div>
                      </form>
                    )}
                    {isExpanded && (
                      <div className="handleliste-sources">
                        {item.sources.map((source, index) => (
                          <p className="handleliste-source" key={index}>
                            <span className="handleliste-source-day">{WEEKDAY_LABELS[source.weekday]}</span>{' '}
                            {source.recipeTitle}: {formatAmount(source.amount, item.unit)}
                            {source.servings !== null && ` (${source.servings.toLocaleString('nb-NO')} pors.)`}
                          </p>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          <h2 className="section-kicker">Egne varer</h2>
          <p className="handleliste-hint">Blir stående til du trykker «Fjern avkryssede»</p>
          <div className="handleliste-rows">
            {sortedManual.map((item) => (
              <div className="handleliste-row-group" key={item.id}>
                <div className="handleliste-row">
                  <button
                    type="button"
                    className="handleliste-check-button"
                    aria-label={item.checked ? `Fjern hake på ${item.name}` : `Huk av ${item.name}`}
                    aria-pressed={item.checked}
                    onClick={() => handleToggleManual(item)}
                    disabled={busy}
                  >
                    <span className={`handleliste-checkbox${item.checked ? ' handleliste-checkbox-checked' : ''}`} />
                  </button>
                  <button
                    type="button"
                    className="handleliste-row-toggle"
                    aria-label={`Rediger ${item.name}`}
                    onClick={() => startEditManual(item)}
                  >
                    <span className={`handleliste-name${item.checked ? ' handleliste-name-checked' : ''}`}>
                      {item.name}
                    </span>
                  </button>
                </div>
                {editing?.kind === 'manual' && editing.id === item.id && (
                  <form className="handleliste-edit-form" onSubmit={(e) => handleSaveManual(e, item)}>
                    <label className="handleliste-edit-field">
                      <span>Vare</span>
                      <input type="text" autoFocus value={editName} onChange={(e) => setEditName(e.target.value)} />
                    </label>
                    <div className="handleliste-edit-actions">
                      <button type="button" className="link-button" onClick={() => setEditing(null)}>
                        Avbryt
                      </button>
                      <button type="submit" className="cta-button" disabled={busy || !editName.trim()}>
                        Lagre
                      </button>
                    </div>
                  </form>
                )}
              </div>
            ))}
          </div>

          {freetextDays.length > 0 && (
            <>
              <h2 className="section-kicker">Ikke dekket av handlelisten</h2>
              <div className="handleliste-freetext-list">
                {freetextDays.map((entry, index) => (
                  <p className="handleliste-freetext-row" key={index}>
                    <span className="handleliste-freetext-day">{WEEKDAY_LABELS[entry.weekday]}</span> · {entry.text}
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
