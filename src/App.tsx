import { useCallback, useEffect, useRef, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './lib/supabaseClient'
import type { Profile, Recipe } from './types'
import { RecipeList } from './components/RecipeList'
import { AddRecipeForm } from './components/AddRecipeForm'
import { Login } from './components/Login'
import './App.css'

function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [recipes, setRecipes] = useState<Recipe[]>([])
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))

    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession)
      setMenuOpen(false)
    })

    return () => listener.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!menuOpen) return

    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [menuOpen])

  const loadRecipes = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('recipes')
      .select('*')
      .order('created_at', { ascending: false })

    if (!error && data) {
      setRecipes(data)
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    loadRecipes()

    supabase
      .from('profiles')
      .select('*')
      .then(({ data, error }) => {
        if (!error && data) {
          setProfiles(data)
        }
      })
  }, [loadRecipes])

  const handleRecipeAdded = useCallback(() => {
    loadRecipes()
    setMenuOpen(false)
  }, [loadRecipes])

  return (
    <div className="page">
      <header className="page-header">
        <div className="menu" ref={menuRef}>
          <button
            className="menu-button"
            aria-label="Meny"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((open) => !open)}
          >
            ☰
          </button>
          {menuOpen && (
            <div className="menu-dropdown">
              {session ? (
                <>
                  <AddRecipeForm onAdded={handleRecipeAdded} />
                  <button className="link-button" onClick={() => supabase.auth.signOut()}>
                    Logg ut
                  </button>
                </>
              ) : (
                <Login />
              )}
            </div>
          )}
        </div>
        <h1>Mine oppskrifter</h1>
      </header>

      <RecipeList
        recipes={recipes}
        profiles={profiles}
        loading={loading}
        currentUserId={session?.user.id ?? null}
        onRecipeChanged={loadRecipes}
      />
    </div>
  )
}

export default App
