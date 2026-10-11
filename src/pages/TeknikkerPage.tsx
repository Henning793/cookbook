import { useNavigate } from 'react-router-dom'
import { ChevronLeft, Plus } from 'lucide-react'
import { useApp } from '../context/AppContext'

export function TeknikkerPage() {
  const navigate = useNavigate()
  const { techniques, loading, session } = useApp()

  return (
    <div className="page samling-page">
      <nav className="nav-bar">
        <button type="button" className="nav-link" onClick={() => navigate('/')}>
          <ChevronLeft size={14} strokeWidth={2.75} aria-hidden="true" />
          Kokeboka
        </button>
        {session && (
          <button type="button" className="nav-link" onClick={() => navigate('/ny?type=teknikk')}>
            <Plus size={14} strokeWidth={2.75} aria-hidden="true" />
            Ny teknikk
          </button>
        )}
      </nav>

      <h1 className="samling-title">Teknikker</h1>

      {loading ? (
        <p className="status-message">Laster teknikker...</p>
      ) : techniques.length === 0 ? (
        <p className="status-message">
          Ingen teknikker enda. Her kan du samle det du slår opp en sjelden gang, som sous-vide eller
          basilikumkaviar.
        </p>
      ) : (
        <div className="samling-recipe-list">
          {techniques.map((technique) => (
            <button
              type="button"
              key={technique.id}
              className="samling-recipe-row"
              onClick={() => navigate(`/oppskrift/${technique.id}`)}
            >
              <span className="samling-recipe-info">
                <span className="samling-recipe-title">{technique.title}</span>
                {technique.description && <span className="samling-recipe-meta">{technique.description}</span>}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
