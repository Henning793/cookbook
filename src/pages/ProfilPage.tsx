import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useApp } from '../context/AppContext'
import { supabase } from '../lib/supabaseClient'
import { Login } from '../components/Login'
import { useInstallApp } from '../components/InstallApp'

const OFFLINE_CACHE_NAME = 'supabase-cache'

export function ProfilPage() {
  const navigate = useNavigate()
  const { session, recipes, profiles, availableTags, members } = useApp()

  const [offlineCount, setOfflineCount] = useState(0)
  // Raden «Installer appen» vises bare når appen kjører i en nettleser som
  // kan installere den (se lib/installApp.ts), også etter at banneret på
  // forsiden er lukket.
  const { method: installMethod, install, guide: installGuide } = useInstallApp()

  // Best-effort count of recipe images already cached for offline use. Falls
  // back to 0 rather than crashing if the Cache API is unavailable or the
  // cache hasn't been created yet (e.g. first load, nothing browsed yet).
  useEffect(() => {
    let cancelled = false

    async function countCachedRecipeImages() {
      try {
        const cache = await caches.open(OFFLINE_CACHE_NAME)
        const requests = await cache.keys()
        const cachedUrls = requests.map((request) => request.url)
        const count = recipes.filter(
          (recipe) => recipe.image_url && cachedUrls.some((url) => url.includes(recipe.image_url as string))
        ).length
        if (!cancelled) setOfflineCount(count)
      } catch {
        if (!cancelled) setOfflineCount(0)
      }
    }

    countCachedRecipeImages()

    return () => {
      cancelled = true
    }
  }, [recipes])

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
        <button type="button" className="profil-row profil-row-button" onClick={() => navigate('/familie')}>
          <span>Gruppe</span>
          <span className="profil-row-chevron" aria-hidden="true">
            <ChevronRight size={14} strokeWidth={2.75} />
          </span>
        </button>
        <div className="profil-row">
          <span>Behold skjermen på i kokemodus</span>
          <span className="profil-row-value profil-row-value-on">På</span>
        </div>
        <div className="profil-row">
          <span>Offline-lagring</span>
          <span className="profil-row-value">
            {offlineCount} av {recipes.length}
          </span>
        </div>
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
