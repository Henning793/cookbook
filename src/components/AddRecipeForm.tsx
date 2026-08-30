import { useState, type FormEvent } from 'react'
import { supabase } from '../lib/supabaseClient'
import { importRecipeFromUrl } from '../lib/importRecipe'
import { RecipeForm, type RecipeFormValues } from './RecipeForm'

interface Props {
  onAdded: () => void
}

type View = 'closed' | 'import' | 'form'

export function AddRecipeForm({ onAdded }: Props) {
  const [view, setView] = useState<View>('closed')
  const [importUrl, setImportUrl] = useState('')
  const [importing, setImporting] = useState(false)
  const [importError, setImportError] = useState('')
  const [importedValues, setImportedValues] = useState<RecipeFormValues | null>(null)

  function reset() {
    setView('closed')
    setImportUrl('')
    setImportError('')
    setImportedValues(null)
  }

  async function handleSubmit(values: RecipeFormValues) {
    const { error } = await supabase.from('recipes').insert(values)
    if (error) throw error
    reset()
    onAdded()
  }

  async function handleImport(e: FormEvent) {
    e.preventDefault()
    setImporting(true)
    setImportError('')

    try {
      const imported = await importRecipeFromUrl(importUrl)
      setImportedValues({ ...imported, image_url: null })
      setView('form')
    } catch (err) {
      setImportError(err instanceof Error ? err.message : 'Noe gikk galt')
    } finally {
      setImporting(false)
    }
  }

  if (view === 'closed') {
    return (
      <div className="add-recipe-entry">
        <button className="add-recipe-toggle" onClick={() => setView('form')}>
          + Legg til oppskrift
        </button>
        <button className="link-button" onClick={() => setView('import')}>
          Importer fra URL
        </button>
      </div>
    )
  }

  if (view === 'import') {
    return (
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
          <button type="button" onClick={reset} disabled={importing}>
            Avbryt
          </button>
          <button type="submit" disabled={importing}>
            {importing ? 'Henter...' : 'Hent oppskrift'}
          </button>
        </div>
      </form>
    )
  }

  return (
    <RecipeForm
      heading={importedValues ? 'Se gjennom importert oppskrift' : 'Ny oppskrift i din kokebok'}
      initial={importedValues ?? undefined}
      submitLabel="Lagre oppskrift"
      savingLabel="Lagrer..."
      onSubmit={handleSubmit}
      onCancel={reset}
    />
  )
}
