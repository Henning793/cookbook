import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { importRecipeFromUrl } from '../lib/importRecipe'
import { useApp } from '../context/AppContext'
import { RecipeForm, type RecipeFormValues } from '../components/RecipeForm'

type View = 'choose' | 'import' | 'form'

export function NyOppskriftPage() {
  const navigate = useNavigate()
  const { availableTags, reload } = useApp()

  const [view, setView] = useState<View>('choose')
  const [importUrl, setImportUrl] = useState('')
  const [importing, setImporting] = useState(false)
  const [importError, setImportError] = useState('')
  const [importedValues, setImportedValues] = useState<RecipeFormValues | null>(null)

  function resetToChoose() {
    setView('choose')
    setImportUrl('')
    setImportError('')
    setImportedValues(null)
  }

  async function handleSubmit(values: RecipeFormValues) {
    const { error } = await supabase.from('recipes').insert(values)
    if (error) throw error
    reload()
    navigate('/')
  }

  async function handleImport(e: FormEvent) {
    e.preventDefault()
    setImporting(true)
    setImportError('')

    try {
      const imported = await importRecipeFromUrl(importUrl)
      setImportedValues({ ...imported, description: null, image_url: null, tags: [], servings: null })
      setView('form')
    } catch (err) {
      setImportError(err instanceof Error ? err.message : 'Noe gikk galt')
    } finally {
      setImporting(false)
    }
  }

  if (view === 'choose') {
    return (
      <div className="page ny-oppskrift-page">
        <nav className="nav-bar">
          <button type="button" className="nav-link nav-link-muted" onClick={() => navigate('/')}>
            Avbryt
          </button>
        </nav>
        <h1 className="ny-oppskrift-title">Ny oppskrift</h1>
        <p className="ny-oppskrift-subline">Skriv selv, eller importer fra en lenke.</p>
        <div className="entry-cards">
          <button type="button" className="entry-card entry-card-accent2" onClick={() => setView('form')}>
            <span className="entry-card-title">Skriv selv</span>
            <span className="entry-card-subtitle">Tomt skjema</span>
          </button>
          <button type="button" className="entry-card entry-card-accent" onClick={() => setView('import')}>
            <span className="entry-card-title">Importer fra URL</span>
            <span className="entry-card-subtitle">Hent fra en lenke</span>
          </button>
        </div>
      </div>
    )
  }

  if (view === 'import') {
    return (
      <div className="page ny-oppskrift-page">
        <nav className="nav-bar">
          <button type="button" className="nav-link nav-link-muted" onClick={resetToChoose}>
            Avbryt
          </button>
        </nav>
        <form className="add-recipe-form" onSubmit={handleImport}>
          <h2>Importer oppskrift fra URL</h2>

          <label htmlFor="import-url">Lenke til oppskrift</label>
          <input
            id="import-url"
            type="url"
            required
            placeholder="https://..."
            value={importUrl}
            onChange={(e) => setImportUrl(e.target.value)}
          />

          {importError && <p className="error">{importError}</p>}

          <div className="form-actions">
            <button type="button" onClick={resetToChoose} disabled={importing}>
              Avbryt
            </button>
            <button type="submit" disabled={importing}>
              {importing ? 'Henter...' : 'Hent oppskrift'}
            </button>
          </div>
        </form>
      </div>
    )
  }

  return (
    <div className="page ny-oppskrift-page ny-oppskrift-form-page">
      <RecipeForm
        heading="Ny oppskrift"
        initial={importedValues ?? undefined}
        availableTags={availableTags}
        submitLabel="Lagre oppskrift"
        saveAtBottom
        savingLabel="Lagrer..."
        onSubmit={handleSubmit}
        onCancel={resetToChoose}
      />
    </div>
  )
}
