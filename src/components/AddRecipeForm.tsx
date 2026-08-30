import { useState, type FormEvent } from 'react'
import { supabase } from '../lib/supabaseClient'

interface Props {
  onAdded: () => void
}

export function AddRecipeForm({ onAdded }: Props) {
  const [title, setTitle] = useState('')
  const [ingredients, setIngredients] = useState('')
  const [steps, setSteps] = useState('')
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [open, setOpen] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError('')

    try {
      let imageUrl: string | null = null

      if (imageFile) {
        const fileExt = imageFile.name.split('.').pop()
        const filePath = `${crypto.randomUUID()}.${fileExt}`

        const { error: uploadError } = await supabase.storage
          .from('recipe-images')
          .upload(filePath, imageFile)

        if (uploadError) throw uploadError

        const { data } = supabase.storage
          .from('recipe-images')
          .getPublicUrl(filePath)

        imageUrl = data.publicUrl
      }

      const { error: insertError } = await supabase.from('recipes').insert({
        title,
        ingredients,
        steps,
        image_url: imageUrl,
      })

      if (insertError) throw insertError

      setTitle('')
      setIngredients('')
      setSteps('')
      setImageFile(null)
      setOpen(false)
      onAdded()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Noe gikk galt')
    } finally {
      setSaving(false)
    }
  }

  if (!open) {
    return (
      <button className="add-recipe-toggle" onClick={() => setOpen(true)}>
        + Legg til oppskrift
      </button>
    )
  }

  return (
    <form className="add-recipe-form" onSubmit={handleSubmit}>
      <h2>Ny oppskrift i din kokebok</h2>

      <label htmlFor="title">Tittel</label>
      <input
        id="title"
        required
        value={title}
        onChange={(e) => setTitle(e.target.value)}
      />

      <label htmlFor="ingredients">Ingredienser</label>
      <textarea
        id="ingredients"
        required
        rows={5}
        placeholder={'1 st løk\n2 dl fløte\n...'}
        value={ingredients}
        onChange={(e) => setIngredients(e.target.value)}
      />

      <label htmlFor="steps">Fremgangsmåte</label>
      <textarea
        id="steps"
        required
        rows={6}
        value={steps}
        onChange={(e) => setSteps(e.target.value)}
      />

      <label htmlFor="image">Bilde (valgfritt)</label>
      <input
        id="image"
        type="file"
        accept="image/*"
        onChange={(e) => setImageFile(e.target.files?.[0] ?? null)}
      />

      {error && <p className="error">{error}</p>}

      <div className="form-actions">
        <button type="button" onClick={() => setOpen(false)} disabled={saving}>
          Avbryt
        </button>
        <button type="submit" disabled={saving}>
          {saving ? 'Lagrer...' : 'Lagre oppskrift'}
        </button>
      </div>
    </form>
  )
}
