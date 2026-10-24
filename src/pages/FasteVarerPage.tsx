import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { X } from 'lucide-react'
import { useApp } from '../context/AppContext'
import { Login } from '../components/Login'
import {
  addStandingItem,
  listStandingItems,
  removeStandingItem,
  renameStandingItem,
  type StandingItem,
  type StandingKind,
} from '../lib/standingItems'
import { getShoppingRange, setShoppingRange } from '../lib/shoppingPreferences'
import { DEFAULT_SHOPPING_RANGE, rangeEnd, rangeEndLabel, type ShoppingRange } from '../lib/shoppingRange'

const TABS: { kind: StandingKind; label: string; description: string }[] = [
  {
    kind: 'always_home',
    label: 'Alltid hjemme',
    description: 'Legg til varer du alltid har hjemme, så blir handlelisten kortere.',
  },
  {
    kind: 'weekly',
    label: 'Faste kjøp',
    description:
      'Legg til varer du kjøper hver uke, så dukker de opp på handlelisten når du oppretter en ny ukesmeny.',
  },
]

interface Draft {
  key: number
  kind: StandingKind
  name: string
  savedId: string | null
}

export function FasteVarerPage() {
  const navigate = useNavigate()
  const { session, family, familyLoading } = useApp()
  const familyId = family?.id ?? null

  const [activeKind, setActiveKind] = useState<StandingKind>('always_home')
  const [items, setItems] = useState<Record<StandingKind, StandingItem[]>>({
    always_home: [],
    weekly: [],
  })
  const [loading, setLoading] = useState(true)
  // Ny linje nederst i listen som lagres mens man skriver, som i handlelisten.
  // `key` gir et nytt felt for hver vare, `savedId` er raden den er lagret som så langt.
  const [draft, setDraft] = useState<Draft | null>(null)
  // Holdes i takt med draft overalt den settes, så lagringene ser siste verdi.
  const draftRef = useRef(draft)
  const draftCount = useRef(0)
  const draftTimer = useRef<number | undefined>(undefined)
  // Raden hver linje er lagret som, så lagringen av en linje man har gått
  // videre fra ikke trenger draftRef.
  const draftSavedIds = useRef(new Map<number, string>())
  // Linjer man har gått videre fra, vist til de er lagret og ligger i listen.
  const [finishing, setFinishing] = useState<{ key: number; kind: StandingKind; name: string }[]>([])
  // Lagringene går én og én, så en vare aldri blir opprettet to ganger.
  const saveChain = useRef<Promise<void>>(Promise.resolve())
  const draftInput = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [range, setRange] = useState<ShoppingRange>(DEFAULT_SHOPPING_RANGE)
  const [rangeError, setRangeError] = useState('')

  useEffect(() => {
    draftInput.current?.scrollIntoView({ block: 'center' })
  }, [draft?.key])

  useEffect(() => {
    if (!session) return
    getShoppingRange()
      .then(setRange)
      .catch((err) => setRangeError(err instanceof Error ? err.message : 'Noe gikk galt'))
  }, [session])

  useEffect(() => {
    if (familyLoading || !session) return
    Promise.all([listStandingItems(familyId, 'always_home'), listStandingItems(familyId, 'weekly')])
      .then(([alwaysHome, weekly]) => {
        setItems({ always_home: alwaysHome, weekly })
        setLoading(false)
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Noe gikk galt')
        setLoading(false)
      })
  }, [familyId, familyLoading, session])

  if (!session) {
    return (
      <div className="page faste-varer-page">
        <nav className="nav-bar">
          <button type="button" className="nav-link" onClick={() => navigate('/handleliste')}>
            Ferdig
          </button>
        </nav>
        <Login />
      </div>
    )
  }

  const tab = TABS.find((t) => t.kind === activeKind)!
  const isWeekly = range !== 'month'

  // Lagres med en gang, som resten av handlelisten.
  async function chooseRange(next: ShoppingRange) {
    if (next === range) return
    const previous = range
    setRange(next)
    setRangeError('')
    try {
      await setShoppingRange(next)
    } catch (err) {
      setRange(previous)
      setRangeError(err instanceof Error ? err.message : 'Noe gikk galt')
    }
  }
  const activeItems = items[activeKind]

  function switchTab(kind: StandingKind) {
    finishDraft()
    setActiveKind(kind)
    setError('')
  }

  function errorMessage(err: unknown) {
    const message = err instanceof Error ? err.message : 'Noe gikk galt'
    return message.includes('duplicate') ? 'Varen ligger allerede i listen.' : message
  }

  // Lagrer det som står i den nye linjen nå: oppretter varen første gang,
  // gir den nytt navn etterpå, og sletter den igjen hvis feltet tømmes.
  // Teksten tas med en gang, så den lagres selv om man har startet en ny
  // linje før lagringen kommer til.
  function saveDraft(key: number) {
    window.clearTimeout(draftTimer.current)
    const current = draftRef.current
    if (!current || current.key !== key) return
    const { kind } = current
    const name = current.name.trim()
    saveChain.current = saveChain.current
      .then(async () => {
        let savedId = draftSavedIds.current.get(key) ?? null
        if (!savedId && name) savedId = await addStandingItem(familyId, kind, name)
        else if (savedId && name) await renameStandingItem(savedId, name)
        else if (savedId && !name) {
          await removeStandingItem(savedId)
          savedId = null
        }
        if (savedId) draftSavedIds.current.set(key, savedId)
        else draftSavedIds.current.delete(key)
        setError('')
        setDraft((d) => (d && d.key === key ? { ...d, savedId } : d))
        draftRef.current = draftRef.current?.key === key ? { ...draftRef.current, savedId } : draftRef.current
      })
      .catch((err) => setError(errorMessage(err)))
  }

  // Ferdig med linjen: lagre det siste og la varen gå inn i listen.
  // Tar nøkkelen til linjen, så en blur fra et gammelt felt aldri lukker en
  // ny linje man allerede har startet på.
  function finishDraft(key = draftRef.current?.key) {
    if (key === undefined || draftRef.current?.key !== key) return
    const { kind } = draftRef.current
    const name = draftRef.current.name.trim()
    saveDraft(key)
    if (name) setFinishing((list) => [...list, { key, kind, name }])
    saveChain.current = saveChain.current
      .then(async () => {
        const refreshed = await listStandingItems(familyId, kind)
        setItems((current) => ({ ...current, [kind]: refreshed }))
      })
      .catch((err) => setError(errorMessage(err)))
      .finally(() => {
        setFinishing((list) => list.filter((line) => line.key !== key))
        draftSavedIds.current.delete(key)
        if (draftRef.current?.key === key) {
          draftRef.current = null
          setDraft(null)
        }
      })
  }

  // Enter starter en ny linje. Tastaturknappen er en vanlig Enter: med
  // enterKeyHint="next" flytter Chrome på Android fokus i stedet for å sende
  // Enter, og da kom det ingen ny linje.
  function handleDraftKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key !== 'Enter') return
    event.preventDefault()
    if (draftRef.current?.name.trim()) startDraft()
  }

  function startDraft() {
    finishDraft()
    const next = { key: ++draftCount.current, kind: activeKind, name: '', savedId: null }
    draftRef.current = next
    setDraft(next)
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

  const activeFinishing = finishing.filter((line) => line.kind === activeKind)
  const hiddenIds = new Set(finishing.map((line) => draftSavedIds.current.get(line.key)))
  if (draft?.savedId) hiddenIds.add(draft.savedId)
  const visibleItems = activeItems.filter((item) => !hiddenIds.has(item.id))

  async function handleRemove(id: string) {
    setBusy(true)
    setError('')
    try {
      await removeStandingItem(id)
      setItems((current) => ({
        ...current,
        [activeKind]: current[activeKind].filter((item) => item.id !== id),
      }))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Noe gikk galt')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="page faste-varer-page">
      <nav className="nav-bar">
        <button type="button" className="nav-link" onClick={() => navigate('/handleliste')}>
          Ferdig
        </button>
      </nav>

      <h1 className="oppskrift-title">Personaliser handlelisten</h1>

      <section className="handleliste-range" aria-labelledby="handleliste-range-title">
        <h2 className="handleliste-range-title" id="handleliste-range-title">
          Hvor langt frem handler du?
        </h2>
        <div className={`handleliste-range-option${isWeekly ? ' handleliste-range-option-active' : ''}`}>
          <button
            type="button"
            className="handleliste-range-choice"
            role="radio"
            aria-checked={isWeekly}
            onClick={() => chooseRange('week')}
          >
            <span className="handleliste-range-radio" aria-hidden="true" />
            <span className="handleliste-range-name">Ukeshandling</span>
          </button>
          {isWeekly && (
            <>
              <div className="handleliste-range-segment" role="radiogroup" aria-label="Ukeshandling">
                <button
                  type="button"
                  role="radio"
                  aria-checked={range === 'week'}
                  className={range === 'week' ? 'handleliste-range-segment-active' : ''}
                  onClick={() => chooseRange('week')}
                >
                  Denne uken
                </button>
                <button
                  type="button"
                  role="radio"
                  aria-checked={range === 'next7'}
                  className={range === 'next7' ? 'handleliste-range-segment-active' : ''}
                  onClick={() => chooseRange('next7')}
                >
                  Neste 7 dager
                </button>
              </div>
              <p className="handleliste-range-note">Nå {rangeEndLabel(rangeEnd(range))}</p>
            </>
          )}
        </div>
        <div className={`handleliste-range-option${!isWeekly ? ' handleliste-range-option-active' : ''}`}>
          <button
            type="button"
            className="handleliste-range-choice"
            role="radio"
            aria-checked={!isWeekly}
            onClick={() => chooseRange('month')}
          >
            <span className="handleliste-range-radio" aria-hidden="true" />
            <span className="handleliste-range-name">
              Månedshandling
              <small>Denne uken + 4 uker · nå {rangeEndLabel(rangeEnd('month'))}</small>
            </span>
          </button>
        </div>
        <p className="handleliste-range-note">Gjelder bare for deg. Resten av familien velger selv.</p>
        {rangeError && <p className="error">{rangeError}</p>}
      </section>

      <h2 className="section-kicker">Faste varer</h2>

      <div className="faste-varer-tabs" role="tablist">
        {TABS.map((t) => (
          <button
            type="button"
            role="tab"
            aria-selected={t.kind === activeKind}
            key={t.kind}
            className={`faste-varer-tab${t.kind === activeKind ? ' faste-varer-tab-active' : ''}`}
            onClick={() => switchTab(t.kind)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <p className="oppskrift-description">{tab.description}</p>

      {error && <p className="error">{error}</p>}

      {loading ? (
        <p className="status-message">Laster...</p>
      ) : (
        <div className="handleliste-rows faste-varer-list">
          {visibleItems.map((item) => (
            <div className="handleliste-row faste-varer-row" key={item.id}>
              <span className="handleliste-name">{item.name}</span>
              <button
                type="button"
                className="faste-varer-remove"
                aria-label={`Fjern ${item.name}`}
                onClick={() => handleRemove(item.id)}
                disabled={busy}
              >
                <X size={14} strokeWidth={2.75} aria-hidden="true" />
              </button>
            </div>
          ))}
          {activeFinishing.map((line) => (
            <div className="handleliste-row faste-varer-row" key={`ny-${line.key}`}>
              <span className="handleliste-name">{line.name}</span>
            </div>
          ))}
          {draft && draft.kind === activeKind && (
            <div className="handleliste-row faste-varer-row faste-varer-draft-row">
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
          )}
        </div>
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
