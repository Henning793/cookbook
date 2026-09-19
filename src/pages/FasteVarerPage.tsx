import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { X } from 'lucide-react'
import { useApp } from '../context/AppContext'
import { Login } from '../components/Login'
import {
  addStandingItem,
  listStandingItems,
  removeStandingItem,
  type StandingItem,
  type StandingKind,
} from '../lib/standingItems'

const TABS: { kind: StandingKind; label: string; description: string; addLabel: string }[] = [
  {
    kind: 'always_home',
    label: 'Alltid hjemme',
    description: 'Legg til varer du alltid har hjemme, så blir handlelisten kortere.',
    addLabel: 'Legg til vare du alltid har hjemme',
  },
  {
    kind: 'weekly',
    label: 'Faste kjøp',
    description:
      'Legg til varer du kjøper hver uke, så dukker de opp på handlelisten når du oppretter en ny ukesmeny.',
    addLabel: 'Legg til fast kjøp',
  },
]

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
  const [showAdd, setShowAdd] = useState(false)
  const [newName, setNewName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

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
  const activeItems = items[activeKind]

  function switchTab(kind: StandingKind) {
    setActiveKind(kind)
    setShowAdd(false)
    setNewName('')
    setError('')
  }

  async function handleAdd(event: React.FormEvent) {
    event.preventDefault()
    const name = newName.trim()
    if (!name) return
    setBusy(true)
    setError('')
    try {
      await addStandingItem(familyId, activeKind, name)
      const refreshed = await listStandingItems(familyId, activeKind)
      setItems((current) => ({ ...current, [activeKind]: refreshed }))
      setNewName('')
      setShowAdd(false)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Noe gikk galt'
      setError(message.includes('duplicate') ? 'Varen ligger allerede i listen.' : message)
    } finally {
      setBusy(false)
    }
  }

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

      <h1 className="oppskrift-title">Faste varer</h1>

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
          {activeItems.map((item) => (
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
        </div>
      )}

      <div className="handleliste-add-footer">
        {showAdd ? (
          <form className="handleliste-add-form" onSubmit={handleAdd}>
            <input
              type="text"
              autoFocus
              placeholder="Vare"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
            />
            <button type="submit" className="cta-button" disabled={busy || !newName.trim()}>
              Legg til
            </button>
          </form>
        ) : (
          <button type="button" className="handleliste-add-pill" onClick={() => setShowAdd(true)}>
            <span className="handleliste-add-icon" aria-hidden="true">
              +
            </span>
            <span className="handleliste-add-label">{tab.addLabel}</span>
          </button>
        )}
      </div>
    </div>
  )
}
