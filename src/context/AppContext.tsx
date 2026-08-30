import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabaseClient'
import { TAGS } from '../lib/tags'
import type { Profile, Recipe } from '../types'

interface Filters {
  ownerId: string | null
  tag: string | null
}

interface CookingSession {
  recipeId: string
  stepIndex: number
}

interface AppContextValue {
  session: Session | null
  recipes: Recipe[]
  profiles: Profile[]
  loading: boolean
  reload: () => void
  availableTags: string[]
  filters: Filters
  setFilters: (patch: Partial<Filters>) => void
  cookingSession: CookingSession | null
  setCookingSession: (session: CookingSession | null) => void
}

const AppContext = createContext<AppContextValue | null>(null)

export function AppProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [recipes, setRecipes] = useState<Recipe[]>([])
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))

    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession)
    })

    return () => listener.subscription.unsubscribe()
  }, [])

  const loadRecipes = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('recipes')
      .select('*')
      .order('created_at', { ascending: false })

    if (!error && data) {
      // Fallback til [] hvis databasen ikke har fått tags-kolonnen ennå
      // (schema.sql ikke kjørt på nytt), slik at appen ikke krasjer.
      setRecipes(data.map((recipe) => ({ ...recipe, tags: recipe.tags ?? [] })))
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

  const availableTags = useMemo(
    () => [...new Set([...TAGS, ...recipes.flatMap((recipe) => recipe.tags)])],
    [recipes]
  )

  const [filters, setFiltersState] = useState<Filters>({
    ownerId: null,
    tag: null,
  })

  function setFilters(patch: Partial<Filters>) {
    setFiltersState((current) => ({ ...current, ...patch }))
  }

  const [cookingSession, setCookingSessionState] = useState<CookingSession | null>(() => {
    try {
      const raw = localStorage.getItem('kokeboka.cooking')
      return raw ? JSON.parse(raw) : null
    } catch {
      return null
    }
  })

  function setCookingSession(session: CookingSession | null) {
    setCookingSessionState(session)
    try {
      if (session) {
        localStorage.setItem('kokeboka.cooking', JSON.stringify(session))
      } else {
        localStorage.removeItem('kokeboka.cooking')
      }
    } catch {
      // localStorage utilgjengelig (privat modus, e.l.) - kokemodus-sesjonen
      // degraderer da til kun in-memory for denne siden, som er en akseptabel avveining.
    }
  }

  const value: AppContextValue = {
    session,
    recipes,
    profiles,
    loading,
    reload: loadRecipes,
    availableTags,
    filters,
    setFilters,
    cookingSession,
    setCookingSession,
  }

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

export function useApp() {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used within AppProvider')
  return ctx
}
