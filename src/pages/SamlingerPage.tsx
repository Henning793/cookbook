import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft } from 'lucide-react'
import { useApp } from '../context/AppContext'
import { listCollections, createCollection } from '../lib/collections'
import type { Collection } from '../types'

export function SamlingerPage() {
  const navigate = useNavigate()
  const { family } = useApp()
  const [collections, setCollections] = useState<Collection[]>([])
  const [loading, setLoading] = useState(true)
  const [newName, setNewName] = useState('')

  useEffect(() => {
    if (!family) return
    listCollections(family.id).then((rows) => {
      setCollections(rows)
      setLoading(false)
    })
  }, [family])

  async function handleCreate(event: React.FormEvent) {
    event.preventDefault()
    if (!family || !newName.trim()) return
    const created = await createCollection(newName.trim(), family.id)
    setCollections((current) => [created, ...current])
    setNewName('')
  }

  return (
    <div className="page samlinger-page">
      <nav className="nav-bar">
        <button type="button" className="nav-link" onClick={() => navigate('/')}>
          <ChevronLeft size={14} strokeWidth={2.75} aria-hidden="true" />
          Kokeboka
        </button>
      </nav>

      <h1 className="oppskrift-title">Samlinger</h1>

      <form onSubmit={handleCreate} className="form-actions">
        <input
          type="text"
          placeholder="Ny samling"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
        />
        <button type="submit">Opprett</button>
      </form>

      {loading ? (
        <p className="status-message">Laster samlinger...</p>
      ) : collections.length === 0 ? (
        <p className="status-message">Ingen samlinger enda.</p>
      ) : (
        <div className="samling-recipe-list">
          {collections.map((collection) => (
            <button
              type="button"
              key={collection.id}
              className="samling-recipe-row"
              onClick={() => navigate(`/samlinger/${collection.id}`)}
            >
              <span className="samling-recipe-title">{collection.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
