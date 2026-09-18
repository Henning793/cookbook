import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft } from 'lucide-react'
import { useApp } from '../context/AppContext'
import { listCollections } from '../lib/collections'
import type { Collection } from '../types'

export function SamlingerPage() {
  const navigate = useNavigate()
  const { family } = useApp()
  const [collections, setCollections] = useState<Collection[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!family) return
    listCollections(family.id).then((rows) => {
      setCollections(rows)
      setLoading(false)
    })
  }, [family])

  return (
    <div className="page samlinger-page">
      <nav className="nav-bar">
        <button type="button" className="nav-link" onClick={() => navigate('/')}>
          <ChevronLeft size={14} strokeWidth={2.75} aria-hidden="true" />
          Kokeboka
        </button>
      </nav>

      <h1 className="oppskrift-title">Samlinger</h1>

      {!family ? (
        <p className="status-message">
          Samlinger krever en familie, siden de er ment for å dele oppskrifter med andre. Bli med
          i eller opprett en familie under "Familie" på profilsiden for å ta dem i bruk.
        </p>
      ) : (
        <p className="oppskrift-description">
          Samlinger følger etikettene dine automatisk — legg en etikett på en oppskrift for å
          plassere den i den tilsvarende samlingen.
        </p>
      )}

      {!family ? null : loading ? (
        <p className="status-message">Laster samlinger...</p>
      ) : collections.length === 0 ? (
        <p className="status-message">Ingen samlinger enda. Legg en etikett på en oppskrift for å opprette en.</p>
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
