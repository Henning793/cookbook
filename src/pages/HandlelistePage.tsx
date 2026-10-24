import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft, ChevronRight, SlidersHorizontal } from 'lucide-react'
import { useApp } from '../context/AppContext'
import { currentWeekStart } from '../lib/menuWeeks'
import { freetextEntries } from '../lib/menuDishes'
import {
  aggregateIngredients,
  applyChecks,
  applyOverrides,
  removeAlwaysHome,
  ingredientKey,
  listCheckedItems,
  setItemChecked,
  setItemUnchecked,
  clearCheckedItems,
  listManualItems,
  addManualItem,
  deleteManualItem,
  setManualChecked,
  renameManualItem,
  listOverrides,
  saveOverride,
  type CheckedIngredient,
  type CheckedItem,
  type ItemOverride,
  type ManualItem,
  type ShoppingRow,
} from '../lib/shoppingList'
import { cachedShopping, type ShoppingData } from '../lib/shoppingCache'
import { loadShoppingData, rememberShoppingData } from '../lib/shoppingLoad'
import { rangeEnd, rangeEndLabel, rangeLabel, shortDayLabel, DEFAULT_SHOPPING_RANGE } from '../lib/shoppingRange'
import { sortShoppingItems } from '../lib/shoppingSort'
import { Login } from '../components/Login'
import type { MenuDay, Recipe } from '../types'

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
  const { session, family, familyLoading, recipes, loading: recipesLoading } = useApp()
  const familyId = family?.id ?? null
  const userId = session?.user.id ?? null
  // Listen sist den ble hentet, så den kan vises med en gang (se
  // shoppingCache.ts). Før familien er lastet brukes den siste brukeren så.
  const [cached] = useState(() =>
    userId ? cachedShopping(localStorage, userId, familyLoading ? undefined : familyId, currentWeekStart()) : undefined
  )

  const [menuDays, setMenuDays] = useState<MenuDay[]>(cached?.days ?? [])
  const [range, setRange] = useState(cached?.range ?? DEFAULT_SHOPPING_RANGE)
  const [end, setEnd] = useState(() => cached?.end ?? rangeEnd(DEFAULT_SHOPPING_RANGE))
  const [checked, setChecked] = useState<CheckedItem[]>(cached?.checked ?? [])
  const [manualItems, setManualItems] = useState<ManualItem[]>(cached?.manualItems ?? [])
  const [overrides, setOverrides] = useState<ItemOverride[]>(cached?.overrides ?? [])
  // Oppskriftene fra forrige gang, til listen kan regnes ut før alle
  // oppskriftene er hentet når appen starter.
  const [cachedRecipes, setCachedRecipes] = useState<Recipe[]>(cached?.recipes ?? [])
  // Hvilken bruker og familie listen som vises nå er hentet for. Bare den
  // huskes når den endres her, ikke en liste vist før familien var lastet.
  const shownFor = useRef<string | null>(null)
  const [editing, setEditing] = useState<Editing | null>(null)
  const [editName, setEditName] = useState('')
  const [editAmount, setEditAmount] = useState('')
  const editingRef = useRef<Editing | null>(null)
  const editValues = useRef({ name: '', amount: '' })
  const editTimer = useRef<number | undefined>(undefined)
  const [alwaysHomeNames, setAlwaysHomeNames] = useState<Set<string>>(() => new Set(cached?.alwaysHome))
  const [loading, setLoading] = useState(!cached)
  // Ny linje nederst i Egne varer som lagres mens man skriver. `key` gir et
  // nytt felt for hver vare, `savedId` er raden den er lagret som så langt.
  const [draft, setDraft] = useState<{ key: number; name: string; savedId: string | null } | null>(null)
  // Holdes i takt med draft overalt den settes, så lagringene ser siste verdi.
  const draftRef = useRef(draft)
  const draftCount = useRef(0)
  const draftTimer = useRef<number | undefined>(undefined)
  // Raden hver linje er lagret som, så lagringen av en linje man har gått
  // videre fra ikke trenger draftRef.
  const draftSavedIds = useRef(new Map<number, string>())
  // Linjer man har gått videre fra, vist til de er lagret og ligger i listen.
  const [finishing, setFinishing] = useState<{ key: number; name: string }[]>([])
  // Telles opp for hver lagring av en ny linje, så en henting som startet før
  // ikke viser en liste uten varen.
  const manualWrites = useRef(0)
  // Lagringene går én og én, så en vare aldri blir opprettet to ganger.
  const saveChain = useRef<Promise<void>>(Promise.resolve())
  const draftInput = useRef<HTMLInputElement>(null)

  useEffect(() => {
    draftInput.current?.scrollIntoView({ block: 'center' })
  }, [draft?.key])
  const [busy, setBusy] = useState(false)
  // Varer der man har trykket på mengden for å se hvilke dager den kommer fra.
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(new Set())

  function showData(data: ShoppingData) {
    setRange(data.range)
    setEnd(data.end)
    setMenuDays(data.days)
    setChecked(data.checked)
    setManualItems(data.manualItems)
    setOverrides(data.overrides)
    setAlwaysHomeNames(new Set(data.alwaysHome))
    setLoading(false)
  }

  // Viser listen fra forrige gang med en gang, og henter den på nytt i
  // bakgrunnen.
  useEffect(() => {
    if (familyLoading || !userId) return
    const key = `${userId}:${familyId ?? 'meg'}`
    const fromCache = cachedShopping(localStorage, userId, familyId, currentWeekStart())
    if (fromCache && shownFor.current !== key) {
      showData(fromCache)
      setCachedRecipes(fromCache.recipes)
      shownFor.current = key
    } else if (!fromCache && shownFor.current !== key) {
      setLoading(true)
    }
    let cancelled = false
    const writesAtStart = manualWrites.current
    loadShoppingData(userId, familyId, null)
      .then((data) => {
        if (cancelled) return
        showData(data)
        shownFor.current = key
        // Varer lagt til mens listen ble hentet mangler i svaret: hent dem på
        // nytt etter lagringene.
        if (manualWrites.current !== writesAtStart) {
          saveChain.current = saveChain.current.then(async () => {
            if (!cancelled) setManualItems(await listManualItems(familyId))
          })
        }
      })
      .catch((error) => {
        console.error('Kunne ikke laste handlelisten', error)
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [userId, familyId, familyLoading])

  // Endringer gjort her (avkrysninger, egne varer) huskes til neste gang.
  useEffect(() => {
    if (loading || familyLoading || !userId || shownFor.current !== `${userId}:${familyId ?? 'meg'}`) return
    rememberShoppingData(
      userId,
      familyId,
      { range, end, days: menuDays, checked, manualItems, overrides, alwaysHome: [...alwaysHomeNames] },
      recipesLoading ? null : recipes
    )
  }, [loading, familyLoading, userId, familyId, range, end, menuDays, checked, manualItems, overrides, alwaysHomeNames, recipes, recipesLoading])

  // Mens oppskriftene hentes regnes listen ut fra dem som ble husket.
  const listRecipes = recipesLoading ? cachedRecipes : recipes
  const waitingForRecipes = recipesLoading && cachedRecipes.length === 0 && menuDays.length > 0

  // Avkrysninger uten dato (fra før perioder fantes) gjelder ut denne uken.
  const aggregated = useMemo(() => {
    const items = removeAlwaysHome(aggregateIngredients(menuDays, listRecipes), alwaysHomeNames)
    return applyOverrides(applyChecks(items, checked, menuDays, listRecipes, rangeEnd('week')), overrides)
  }, [menuDays, listRecipes, alwaysHomeNames, checked, overrides])

  const sortedAggregated = useMemo(() => {
    return sortShoppingItems(aggregated, (item) => item.displayName, (item) => item.checked)
  }, [aggregated])

  const uncheckedFromRecipesCount = aggregated.filter((item) => !item.checked).length
  const sortedManual = useMemo(
    () => sortShoppingItems(manualItems, (item) => item.name, (item) => item.checked),
    [manualItems]
  )
  const itemsLeft = uncheckedFromRecipesCount + manualItems.filter((m) => !m.checked).length

  const freetextDays = freetextEntries(menuDays)
  const hasCheckedItems = aggregated.some((item) => item.checked) || manualItems.some((m) => m.checked)

  async function toggleChecked(item: CheckedIngredient) {
    setBusy(true)
    try {
      if (item.checked) {
        await setItemUnchecked(familyId, item.normalizedName, item.unit)
      } else {
        await setItemChecked(familyId, item.normalizedName, item.unit, end)
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
    beginEdit({ kind: 'recipe', key: keyFor(item.normalizedName, item.unit) }, item.displayName,
      item.amountText ?? formatAmount(item.amount, item.unit))
  }

  function startEditManual(item: ManualItem) {
    beginEdit({ kind: 'manual', id: item.id }, item.name, '')
  }

  function beginEdit(target: Editing, name: string, amount: string) {
    if (editingRef.current) finishEdit(editingRef.current)
    editingRef.current = target
    editValues.current = { name, amount }
    setEditing(target)
    setEditName(name)
    setEditAmount(amount)
  }

  function sameEdit(a: Editing | null, b: Editing | null) {
    if (!a || !b || a.kind !== b.kind) return false
    return a.kind === 'recipe' ? a.key === (b as typeof a).key : a.id === (b as typeof a).id
  }

  function handleEditChange(field: 'name' | 'amount', value: string) {
    const target = editingRef.current
    if (!target) return
    editValues.current = { ...editValues.current, [field]: value }
    if (field === 'name') setEditName(value)
    else setEditAmount(value)
    window.clearTimeout(editTimer.current)
    editTimer.current = window.setTimeout(() => saveEdit(target), 600)
  }

  // Lagrer linjen som redigeres, uten å oppdatere listen, så raden ikke
  // hopper til ny plass i sorteringen mens man skriver. For varer fra
  // ukens retter lagres bare det som avviker fra det utregnede: et tomt
  // felt eller den opprinnelige verdien betyr «som utregnet».
  function saveEdit(target: Editing) {
    window.clearTimeout(editTimer.current)
    const { name: rawName, amount: rawAmount } = editValues.current
    const name = rawName.trim()
    const amount = rawAmount.trim()
    saveChain.current = saveChain.current
      .then(async () => {
        if (target.kind === 'manual') {
          const item = manualItems.find((m) => m.id === target.id)
          if (item && name && name !== item.name) await renameManualItem(item.id, name)
        } else {
          const item = aggregated.find((i) => keyFor(i.normalizedName, i.unit) === target.key)
          if (!item) return
          await saveOverride(
            familyId,
            item.normalizedName,
            item.unit,
            name && name !== item.originalName ? name : null,
            amount && amount !== formatAmount(item.amount, item.unit) ? amount : null
          )
        }
      })
      .catch((error) => console.error('Kunne ikke lagre endringen', error))
  }

  // Ferdig med linjen: lagre det siste og hent listen på nytt.
  function finishEdit(target: Editing) {
    if (!sameEdit(editingRef.current, target)) return
    saveEdit(target)
    editingRef.current = null
    setEditing(null)
    saveChain.current = saveChain.current.then(async () => {
      if (target.kind === 'manual') setManualItems(await listManualItems(familyId))
      else setOverrides(await listOverrides(familyId))
    })
  }

  // Navn og mengde er to felt i samme linje: å flytte seg mellom dem
  // avslutter ikke redigeringen.
  function handleEditBlur(event: React.FocusEvent<HTMLInputElement>, target: Editing) {
    const row = event.currentTarget.closest('.handleliste-row')
    const next = event.relatedTarget
    if (row && next instanceof HTMLInputElement && row.contains(next)) return
    finishEdit(target)
  }

  function handleEditKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter') {
      event.preventDefault()
      event.currentTarget.blur()
    }
  }

  // Lagrer det som står i den nye linjen nå: oppretter varen første gang,
  // gir den nytt navn etterpå, og sletter den igjen hvis feltet tømmes.
  // Teksten tas med en gang, så den lagres selv om man har startet en ny
  // linje før lagringen kommer til.
  function saveDraft(key: number) {
    window.clearTimeout(draftTimer.current)
    const current = draftRef.current
    if (!current || current.key !== key) return
    const name = current.name.trim()
    manualWrites.current++
    saveChain.current = saveChain.current
      .then(async () => {
        let savedId = draftSavedIds.current.get(key) ?? null
        if (!savedId && name) savedId = await addManualItem(familyId, name)
        else if (savedId && name) await renameManualItem(savedId, name)
        else if (savedId && !name) {
          await deleteManualItem(savedId)
          savedId = null
        }
        if (savedId) draftSavedIds.current.set(key, savedId)
        else draftSavedIds.current.delete(key)
        setDraft((d) => (d && d.key === key ? { ...d, savedId } : d))
        draftRef.current = draftRef.current?.key === key ? { ...draftRef.current, savedId } : draftRef.current
      })
      .catch((error) => console.error('Kunne ikke lagre vare', error))
  }

  // Ferdig med linjen: lagre det siste og la varen gå inn i listen.
  // Tar nøkkelen til linjen, så en blur fra et gammelt felt aldri lukker en
  // ny linje man allerede har startet på.
  function finishDraft(key = draftRef.current?.key) {
    if (key === undefined || draftRef.current?.key !== key) return
    const name = draftRef.current.name.trim()
    saveDraft(key)
    if (name) setFinishing((list) => [...list, { key, name }])
    saveChain.current = saveChain.current
      .then(async () => {
        setManualItems(await listManualItems(familyId))
      })
      .catch((error) => console.error('Kunne ikke hente egne varer', error))
      .finally(() => {
        setFinishing((list) => list.filter((line) => line.key !== key))
        draftSavedIds.current.delete(key)
        if (draftRef.current?.key === key) {
          draftRef.current = null
          setDraft(null)
        }
      })
  }

  function startDraft() {
    finishDraft()
    const next = { key: ++draftCount.current, name: '', savedId: null }
    draftRef.current = next
    setDraft(next)
  }

  // Enter starter en ny linje. Tastaturknappen er en vanlig Enter: med
  // enterKeyHint="next" flytter Chrome på Android fokus i stedet for å sende
  // Enter, og da kom det ingen ny linje.
  function handleDraftKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key !== 'Enter') return
    event.preventDefault()
    if (draftRef.current?.name.trim()) startDraft()
  }

  function handleDraftChange(name: string) {
    const current = draftRef.current
    if (!current) return
    const next = { ...current, name }
    draftRef.current = next
    setDraft(next)
    window.clearTimeout(draftTimer.current)
    draftTimer.current = window.setTimeout(() => saveDraft(current.key), 600)
  }

  // Den nye linjen legges nederst blant varene som ikke er krysset av,
  // over de avkryssede (de ligger alltid sist, se sortShoppingItems).
  const hiddenIds = new Set(finishing.map((line) => draftSavedIds.current.get(line.key)))
  if (draft?.savedId) hiddenIds.add(draft.savedId)
  const visibleManual = sortedManual.filter((item) => !hiddenIds.has(item.id))
  const firstChecked = visibleManual.findIndex((item) => item.checked)
  const draftIndex = firstChecked === -1 ? visibleManual.length : firstChecked

  function renderManualRow(item: ManualItem) {
    return (
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
          {editing?.kind === 'manual' && editing.id === item.id ? (
            <input
              type="text"
              className="handleliste-inline-input"
              aria-label="Vare"
              placeholder={item.name}
              autoFocus
              enterKeyHint="done"
              value={editName}
              onChange={(e) => handleEditChange('name', e.target.value)}
              onBlur={(e) => handleEditBlur(e, { kind: 'manual', id: item.id })}
              onKeyDown={handleEditKeyDown}
            />
          ) : (
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
          )}
        </div>
      </div>
    )
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
      <button type="button" className="handleliste-period" onClick={() => navigate('/handleliste/faste')}>
        <span className="handleliste-period-icon" aria-hidden="true">
          <SlidersHorizontal size={14} strokeWidth={2.5} />
        </span>
        <span className="handleliste-period-text">
          <strong>{rangeLabel(range)}</strong>
          {rangeEndLabel(end)}
        </span>
        <span className="handleliste-period-action">
          Personaliser
          <ChevronRight size={14} strokeWidth={2.75} aria-hidden="true" />
        </span>
      </button>
      <p className="oppskrift-description">{itemsLeft} varer igjen</p>

      {loading || waitingForRecipes ? (
        <p className="status-message">Laster handleliste...</p>
      ) : (
        <>
          <h2 className="section-kicker">Fra ukesmenyen</h2>
          {sortedAggregated.length === 0 ? (
            <p className="status-message">Ingen retter i ukesmenyen enda.</p>
          ) : (
            <div className="handleliste-rows">
              {sortedAggregated.map((item) => {
                const key = keyFor(item.normalizedName, item.unit)
                const isChecked = item.checked
                // En vare som trengs igjen viser den nye mengden, ikke en
                // mengde skrevet inn for hånd til forrige handletur.
                const amountText = item.extra ? null : item.amountText
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
                      {isEditing ? (
                        <>
                          <input
                            type="text"
                            className="handleliste-inline-input"
                            aria-label="Vare"
                            placeholder={item.originalName}
                            autoFocus
                            enterKeyHint="done"
                            value={editName}
                            onChange={(e) => handleEditChange('name', e.target.value)}
                            onBlur={(e) => handleEditBlur(e, { kind: 'recipe', key })}
                            onKeyDown={handleEditKeyDown}
                          />
                          <input
                            type="text"
                            className="handleliste-inline-input handleliste-inline-amount"
                            aria-label="Mengde"
                            placeholder={formatAmount(item.amount, item.unit)}
                            enterKeyHint="done"
                            value={editAmount}
                            onChange={(e) => handleEditChange('amount', e.target.value)}
                            onBlur={(e) => handleEditBlur(e, { kind: 'recipe', key })}
                            onKeyDown={handleEditKeyDown}
                          />
                        </>
                      ) : (
                        <>
                          <button
                            type="button"
                            className="handleliste-row-toggle"
                            aria-label={`Rediger ${item.displayName}`}
                            onClick={() => startEditRecipeItem(item)}
                          >
                            <span className={`handleliste-name${isChecked ? ' handleliste-name-checked' : ''}`}>
                              {item.displayName}
                              {item.extra && (
                                <span className="handleliste-extra">+{formatAmount(item.amount, item.unit)}</span>
                              )}
                            </span>
                          </button>
                          <button
                            type="button"
                            className={`handleliste-amount${item.scaled && !amountText ? ' handleliste-amount-scaled' : ''}`}
                            aria-expanded={isExpanded}
                            aria-label={`Vis hvor ${item.displayName.toLowerCase()} kommer fra`}
                            onClick={() => toggleExpanded(key)}
                          >
                            {amountText ?? formatAmount(item.amount, item.unit)}
                          </button>
                        </>
                      )}
                    </div>
                    {isExpanded && (
                      <div className="handleliste-sources">
                        {item.sources.map((source, index) => (
                          <p className="handleliste-source" key={index}>
                            <span className="handleliste-source-day">{shortDayLabel(source.date)}</span>{' '}
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
            {visibleManual.slice(0, draftIndex).map(renderManualRow)}
            {finishing.map((line) => (
              <div className="handleliste-row-group" key={`ny-${line.key}`}>
                <div className="handleliste-row">
                  <span className="handleliste-checkbox" aria-hidden="true" />
                  <span className="handleliste-name">{line.name}</span>
                </div>
              </div>
            ))}
            {draft && (
              <div className="handleliste-row-group">
                <div className="handleliste-row handleliste-draft-row">
                  <span className="handleliste-checkbox" aria-hidden="true" />
                  <input
                    key={draft.key}
                    type="text"
                    className="handleliste-inline-input"
                    aria-label="Ny vare"
                    placeholder="Ny vare"
                    autoFocus
                    enterKeyHint="enter"
                    value={draft.name}
                    ref={draftInput}
                    onChange={(e) => handleDraftChange(e.target.value)}
                    onBlur={() => finishDraft(draft.key)}
                    onKeyDown={handleDraftKeyDown}
                  />
                </div>
              </div>
            )}
            {visibleManual.slice(draftIndex).map(renderManualRow)}
          </div>

          {freetextDays.length > 0 && (
            <>
              <h2 className="section-kicker">Ikke dekket av handlelisten</h2>
              <div className="handleliste-freetext-list">
                {freetextDays.map((entry, index) => (
                  <p className="handleliste-freetext-row" key={index}>
                    <span className="handleliste-freetext-day">{shortDayLabel(entry.date)}</span> · {entry.text}
                  </p>
                ))}
              </div>
            </>
          )}
        </>
      )}

      <div className="handleliste-add-footer">
        {/* pointerdown holder fokus i linjen man skriver på, så tastaturet blir
            stående og neste linje kan starte med en gang. */}
        <button
          type="button"
          className="handleliste-add-pill"
          onPointerDown={(e) => e.preventDefault()}
          onClick={() => startDraft()}
        >
          <span className="handleliste-add-icon" aria-hidden="true">
            +
          </span>
          <span className="handleliste-add-label">Legg til vare</span>
        </button>
      </div>
    </div>
  )
}
