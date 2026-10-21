import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabaseClient'
import { TAGS } from '../lib/tags'
import { capitalizeFirst, capitalizeIngredients, normalizeIngredients } from '../lib/recipeIngredients'
import { getMyMembership, getMyFamily, listMembers } from '../lib/families'
import { listIncomingShares, listOutgoingShares } from '../lib/shares'
import { readCookingSession, writeCookingSession, type CookingSession } from '../lib/cookingSession'
import { clearMenuCache } from '../lib/menuCache'
import { clearSupabaseCache, removeLegacyCache } from '../lib/offlineCache'
import type { Family, FamilyMember, FamilyRole, FamilyShare, Profile, Recipe } from '../types'

interface Filters {
  ownerId: string | null
  tag: string | null
}

interface AppContextValue {
  session: Session | null
  // Sann til den lagrede innloggingen er lest, så forsiden ikke rekker å
  // vise landingssiden til en som allerede er innlogget.
  sessionLoading: boolean
  // Bare vanlige oppskrifter. Teknikker ligger i techniques, og allRecipes
  // har begge deler for oppslag på id.
  recipes: Recipe[]
  techniques: Recipe[]
  allRecipes: Recipe[]
  profiles: Profile[]
  loading: boolean
  reload: () => void
  availableTags: string[]
  filters: Filters
  setFilters: (patch: Partial<Filters>) => void
  cookingSession: CookingSession | null
  setCookingSession: (session: CookingSession | null) => void
  family: Family | null
  members: FamilyMember[]
  myRole: FamilyRole | null
  incomingShares: FamilyShare[]
  outgoingShares: FamilyShare[]
  familyLoading: boolean
  reloadFamily: () => void
}

const AppContext = createContext<AppContextValue | null>(null)

export function AppProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [sessionLoading, setSessionLoading] = useState(true)
  const [allRecipes, setAllRecipes] = useState<Recipe[]>([])
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth
      .getSession()
      .then(({ data }) => setSession(data.session))
      .finally(() => setSessionLoading(false))

    removeLegacyCache()

    const { data: listener } = supabase.auth.onAuthStateChange((event, newSession) => {
      if (event === 'SIGNED_OUT') clearSupabaseCache()
      setSession(newSession)
      setSessionLoading(false)
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
      // ingredients tolkes av normalizeIngredients, slik at eldre rader (flat
      // liste med overskrifter) vises som komponenter uten databaseendring.
      // Navn og steg får stor forbokstav her også, så oppskrifter lagret før
      // det ble gjort ved lagring vises likt som nye.
      // kind faller tilbake til 'recipe' til migration_teknikker.sql er kjørt.
      setAllRecipes(
        data.map((recipe) => ({
          ...recipe,
          tags: recipe.tags ?? [],
          kind: recipe.kind === 'technique' ? 'technique' : 'recipe',
          ingredients: capitalizeIngredients(normalizeIngredients(recipe.ingredients)),
          steps: Array.isArray(recipe.steps) ? recipe.steps.map(capitalizeFirst) : recipe.steps,
        }))
      )
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

  const recipes = useMemo(() => allRecipes.filter((recipe) => recipe.kind === 'recipe'), [allRecipes])
  const techniques = useMemo(() => allRecipes.filter((recipe) => recipe.kind === 'technique'), [allRecipes])

  const [family, setFamily] = useState<Family | null>(null)
  const [members, setMembers] = useState<FamilyMember[]>([])
  const [myRole, setMyRole] = useState<FamilyRole | null>(null)
  const [incomingShares, setIncomingShares] = useState<FamilyShare[]>([])
  const [outgoingShares, setOutgoingShares] = useState<FamilyShare[]>([])
  const [familyLoading, setFamilyLoading] = useState(true)

  const familyLoadGeneration = useRef(0)

  const loadFamily = useCallback(async () => {
    const generation = ++familyLoadGeneration.current
    setFamilyLoading(true)
    try {
      const membership = await getMyMembership()
      if (generation !== familyLoadGeneration.current) return
      if (!membership) {
        setFamily(null)
        setMembers([])
        setMyRole(null)
        setIncomingShares([])
        setOutgoingShares([])
        setFamilyLoading(false)
        return
      }
      setMyRole(membership.role)
      const [familyRow, memberRows, incoming, outgoing] = await Promise.all([
        getMyFamily(membership.family_id),
        listMembers(membership.family_id),
        listIncomingShares(membership.family_id),
        listOutgoingShares(membership.family_id),
      ])
      if (generation !== familyLoadGeneration.current) return
      setFamily(familyRow)
      setMembers(memberRows)
      setIncomingShares(incoming)
      setOutgoingShares(outgoing)
      setFamilyLoading(false)
    } catch (err) {
      if (generation !== familyLoadGeneration.current) return
      console.error('Kunne ikke laste familiedata', err)
      setFamilyLoading(false)
    }
  }, [])

  // Familien lastes på nytt bare når en annen bruker logger inn, ikke hver
  // gang innloggingen fornyes (f.eks. når appen kommer tilbake fra bakgrunnen).
  const sessionUserId = session?.user.id ?? null
  useEffect(() => {
    clearMenuCache()
    if (sessionUserId) {
      loadFamily()
    } else {
      familyLoadGeneration.current += 1
      setFamily(null)
      setMembers([])
      setMyRole(null)
      setIncomingShares([])
      setOutgoingShares([])
      setFamilyLoading(false)
    }
  }, [sessionUserId, loadFamily])

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

  // Kokeøkten hører til én bruker (se lib/cookingSession). Den leses på nytt
  // når en annen bruker logger inn, og er tom til innloggingen er lest.
  const userId = session?.user.id ?? null
  const [cooking, setCooking] = useState<{ userId: string | null; session: CookingSession | null } | null>(null)
  let currentCooking = cooking
  if (!sessionLoading && (!currentCooking || currentCooking.userId !== userId)) {
    currentCooking = { userId, session: readCookingSession(localStorage, userId) }
    setCooking(currentCooking)
  }
  const cookingSession = currentCooking?.session ?? null

  function setCookingSession(newSession: CookingSession | null) {
    const stamped = newSession ? { ...newSession, savedAt: Date.now() } : null
    setCooking({ userId, session: stamped })
    writeCookingSession(localStorage, userId, stamped)
  }

  const value: AppContextValue = {
    session,
    sessionLoading,
    recipes,
    techniques,
    allRecipes,
    profiles,
    loading,
    reload: loadRecipes,
    availableTags,
    filters,
    setFilters,
    cookingSession,
    setCookingSession,
    family,
    members,
    myRole,
    incomingShares,
    outgoingShares,
    familyLoading,
    reloadFamily: loadFamily,
  }

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

export function useApp() {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used within AppProvider')
  return ctx
}
