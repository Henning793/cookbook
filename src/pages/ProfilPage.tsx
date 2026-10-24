import { useNavigate } from 'react-router-dom'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useApp } from '../context/AppContext'
import { supabase } from '../lib/supabaseClient'
import { Login } from '../components/Login'
import { useInstallApp } from '../components/InstallApp'

export function ProfilPage() {
  const navigate = useNavigate()
  const { session, recipes, profiles, availableTags, members, family, familyLoading } = useApp()

  // Raden «Installer appen» vises bare når appen kjører i en nettleser som
  // kan installere den (se lib/installApp.ts), også etter at banneret på
  // forsiden er lukket.
  const { method: installMethod, install, guide: installGuide } = useInstallApp()

  async function handleLogout() {
    await supabase.auth.signOut()
  }

  if (!session) {
    return (
      <div className="page profil-page">
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

  const profile = profiles.find((p) => p.id === session.user.id)
  const name = profile?.display_name ?? session.user.email ?? 'Du'
  const initial = name.charAt(0).toUpperCase()

  // Raden viser navnet på gruppen man er med i, eller «Opprett gruppe» uten
  // gruppe (gruppesiden viser da skjemaet for å opprette en). Mens gruppen
  // lastes står det «Gruppe», så raden ikke blinker «Opprett gruppe».
  const groupRowLabel = family ? family.name : familyLoading ? 'Gruppe' : 'Opprett gruppe'

  const usedTags = new Set(recipes.flatMap((recipe) => recipe.tags))
  const collectionCount = availableTags.filter((tag) => usedTags.has(tag)).length

  return (
    <div className="page profil-page">
      <nav className="nav-bar">
        <button type="button" className="nav-link" onClick={() => navigate('/')}>
          <ChevronLeft size={14} strokeWidth={2.75} aria-hidden="true" />
          Kokeboka
        </button>
      </nav>

      <div className="profil-identity">
        <div className="profil-avatar" aria-hidden="true">
          {initial}
        </div>
        <div>
          <p className="profil-name">{name}</p>
          {session.user.email && <p className="profil-email">{session.user.email}</p>}
        </div>
      </div>

      <div className="profil-stats">
        <div className="profil-stat">
          <p className="profil-stat-value">{recipes.length}</p>
          <p className="profil-stat-label">Oppskrifter</p>
        </div>
        <div className="profil-stat">
          <p className="profil-stat-value">{collectionCount}</p>
          <p className="profil-stat-label">Samlinger</p>
        </div>
        <div className="profil-stat">
          <p className="profil-stat-value">{members.length}</p>
          <p className="profil-stat-label">Medlemmer</p>
        </div>
      </div>

      <p className="profil-kicker">Appen</p>
      <div className="profil-group">
        <button type="button" className="profil-row profil-row-button" onClick={() => navigate('/tips')}>
          <span>Tips og triks</span>
          <span className="profil-row-chevron" aria-hidden="true">
            <ChevronRight size={14} strokeWidth={2.75} />
          </span>
        </button>
        {/* Samlingene som kan deles med andre grupper. Lenken lå før på forsiden. */}
        <button type="button" className="profil-row profil-row-button" onClick={() => navigate('/samlinger')}>
          <span>Samlinger</span>
          <span className="profil-row-chevron" aria-hidden="true">
            <ChevronRight size={14} strokeWidth={2.75} />
          </span>
        </button>
        <button type="button" className="profil-row profil-row-button" onClick={() => navigate('/familie')}>
          <span className="profil-row-label">{groupRowLabel}</span>
          <span className="profil-row-chevron" aria-hidden="true">
            <ChevronRight size={14} strokeWidth={2.75} />
          </span>
        </button>
        {installMethod !== 'none' && (
          <button type="button" className="profil-row profil-row-button" onClick={install}>
            <span>Installer appen</span>
            <span className="profil-row-chevron" aria-hidden="true">
              <ChevronRight size={14} strokeWidth={2.75} />
            </span>
          </button>
        )}
      </div>

      <button type="button" className="profil-logout" onClick={handleLogout}>
        Logg ut
      </button>

      {installGuide}
    </div>
  )
}
