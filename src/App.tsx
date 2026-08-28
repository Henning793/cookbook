import { useCallback, useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './lib/supabaseClient'
import type { Recipe } from './types'
import { RecipeList } from './components/RecipeList'
import { AddRecipeForm } from './components/AddRecipeForm'
import { Login } from './components/Login'
import './App.css'

function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [recipes, setRecipes] = useState<Recipe[]>([])
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
      setRecipes(data)
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    loadRecipes()
  }, [loadRecipes])

  return (
    <div className="page">
      <header className="page-header">
        <h1>Mine oppskrifter</h1>
        {session ? (
          <button className="link-button" onClick={() => supabase.auth.signOut()}>
            Logg ut
          </button>
        ) : null}
      </header>

      {session ? (
        <AddRecipeForm onAdded={loadRecipes} />
      ) : (
        <Login />
      )}

      <RecipeList recipes={recipes} loading={loading} />
    </div>
  )
}

export default App
