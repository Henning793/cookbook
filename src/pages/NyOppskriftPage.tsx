import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Camera, Images, X } from 'lucide-react'
import { supabase } from '../lib/supabaseClient'
import { importRecipeFromUrl } from '../lib/importRecipe'
import { MAX_RECIPE_IMAGES, recipeFromImages } from '../lib/recipeFromImage'
import { errorMessage } from '../lib/errorMessage'
import { useApp } from '../context/AppContext'
import { RecipeForm, type RecipeFormValues } from '../components/RecipeForm'

type View = 'choose' | 'import' | 'photo' | 'form'

interface Photo {
  file: File
  url: string
}

export function NyOppskriftPage() {
  const navigate = useNavigate()
  const { availableTags, reload } = useApp()

  const [view, setView] = useState<View>('choose')
  const [importUrl, setImportUrl] = useState('')
  const [importing, setImporting] = useState(false)
  const [importError, setImportError] = useState('')
  const [importedValues, setImportedValues] = useState<RecipeFormValues | null>(null)
  const [photos, setPhotos] = useState<Photo[]>([])
  const [reading, setReading] = useState(false)
  const [photoError, setPhotoError] = useState('')
  const cameraInput = useRef<HTMLInputElement>(null)
  const galleryInput = useRef<HTMLInputElement>(null)

  // Forhåndsvisningene er object-URL-er og må frigis når siden forlates.
  const photosRef = useRef(photos)
  useEffect(() => {
    photosRef.current = photos
  })
  useEffect(() => () => photosRef.current.forEach((photo) => URL.revokeObjectURL(photo.url)), [])

  function resetToChoose() {
    setView('choose')
    setImportUrl('')
    setImportError('')
    setImportedValues(null)
    photos.forEach((photo) => URL.revokeObjectURL(photo.url))
    setPhotos([])
    setPhotoError('')
  }

  function addPhotos(e: ChangeEvent<HTMLInputElement>) {
    const files = [...(e.target.files ?? [])].filter((file) => file.type.startsWith('image/'))
    // Tømmes så samme bilde kan velges på nytt etter at det er fjernet.
    e.target.value = ''
    if (files.length === 0) return
    const room = MAX_RECIPE_IMAGES - photos.length
    setPhotoError(files.length > room ? `Du kan legge til maks ${MAX_RECIPE_IMAGES} bilder per oppskrift.` : '')
    setPhotos((current) => [
      ...current,
      ...files.slice(0, Math.max(0, room)).map((file) => ({ file, url: URL.createObjectURL(file) })),
    ])
  }

  function removePhoto(index: number) {
    URL.revokeObjectURL(photos[index].url)
    setPhotos((current) => current.filter((_, i) => i !== index))
    setPhotoError('')
  }

  async function handleReadPhotos(e: FormEvent) {
    e.preventDefault()
    setReading(true)
    setPhotoError('')

    try {
      const scanned = await recipeFromImages(photos.map((photo) => photo.file))
      setImportedValues({ ...scanned, image_url: null, tags: [] })
      setView('form')
    } catch (err) {
      setPhotoError(errorMessage(err, 'Noe gikk galt'))
    } finally {
      setReading(false)
    }
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
      setImportedValues({
        title: imported.title,
        ingredients: { loose: imported.loose, components: imported.components },
        steps: imported.steps,
        description: null,
        image_url: null,
        tags: [],
        servings: imported.servings,
      })
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
        <p className="ny-oppskrift-subline">Skriv selv, importer fra en lenke, eller ta bilde av en oppskrift.</p>
        <div className="entry-cards">
          <button type="button" className="entry-card entry-card-accent2" onClick={() => setView('form')}>
            <span className="entry-card-title">Skriv selv</span>
            <span className="entry-card-subtitle">Tomt skjema</span>
          </button>
          <button type="button" className="entry-card entry-card-accent" onClick={() => setView('import')}>
            <span className="entry-card-title">Importer fra URL</span>
            <span className="entry-card-subtitle">Hent fra en lenke</span>
          </button>
          <button type="button" className="entry-card entry-card-neutral entry-card-wide" onClick={() => setView('photo')}>
            <span className="entry-card-title">Fra bilde</span>
            <span className="entry-card-subtitle">Ta bilde av en oppskrift, eller velg fra galleriet</span>
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

  if (view === 'photo') {
    const full = photos.length >= MAX_RECIPE_IMAGES
    return (
      <div className="page ny-oppskrift-page">
        <nav className="nav-bar">
          <button type="button" className="nav-link nav-link-muted" onClick={resetToChoose} disabled={reading}>
            Avbryt
          </button>
        </nav>
        <form className="add-recipe-form photo-import-form" onSubmit={handleReadPhotos}>
          <h2>Oppskrift fra bilde</h2>
          <p className="photo-import-hint">
            Ta bilde av oppskriften, eller velg bilder fra galleriet. Går oppskriften over flere sider, legger du til
            ett bilde per side. Du får se over og rette alt før den lagres.
          </p>

          {photos.length > 0 && (
            <ul className="photo-import-list">
              {photos.map((photo, index) => (
                <li key={photo.url}>
                  <img src={photo.url} alt={`Bilde ${index + 1}`} />
                  <button
                    type="button"
                    className="photo-import-remove"
                    onClick={() => removePhoto(index)}
                    disabled={reading}
                    aria-label={`Fjern bilde ${index + 1}`}
                  >
                    <X size={16} aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
          )}

          <div className="photo-import-buttons">
            <button type="button" onClick={() => cameraInput.current?.click()} disabled={reading || full}>
              <Camera size={18} aria-hidden="true" />
              Ta bilde
            </button>
            <button type="button" onClick={() => galleryInput.current?.click()} disabled={reading || full}>
              <Images size={18} aria-hidden="true" />
              Velg fra galleriet
            </button>
          </div>
          <input ref={cameraInput} type="file" accept="image/*" capture="environment" hidden onChange={addPhotos} />
          <input ref={galleryInput} type="file" accept="image/*" multiple hidden onChange={addPhotos} />

          {photoError && <p className="error">{photoError}</p>}

          <div className="form-actions">
            <button type="button" onClick={resetToChoose} disabled={reading}>
              Avbryt
            </button>
            <button type="submit" disabled={reading || photos.length === 0}>
              {reading ? 'Leser oppskriften...' : 'Les oppskrift'}
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
