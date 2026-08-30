import { useState, type FormEvent } from 'react'
import { supabase } from '../lib/supabaseClient'
import { UNITS } from '../lib/units'

interface Props {
  onAdded: () => void
}

interface IngredientRow {
  amount: string
  unit: string
  customUnit: string
  name: string
}

const emptyIngredientRow = (): IngredientRow => ({ amount: '', unit: UNITS[0], customUnit: '', name: '' })

export function AddRecipeForm({ onAdded }: Props) {
  const [title, setTitle] = useState('')
  const [ingredientRows, setIngredientRows] = useState<IngredientRow[]>([emptyIngredientRow()])
  const [steps, setSteps] = useState<string[]>([''])
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [open, setOpen] = useState(false)

  function updateIngredientRow(index: number, patch: Partial<IngredientRow>) {
    setIngredientRows((rows) => rows.map((row, i) => (i === index ? { ...row, ...patch } : row)))
  }

  function addIngredientRow() {
    setIngredientRows((rows) => [...rows, emptyIngredientRow()])
  }

  function removeIngredientRow(index: number) {
    setIngredientRows((rows) => rows.filter((_, i) => i !== index))
  }

  function updateStep(index: number, value: string) {
    setSteps((current) => current.map((step, i) => (i === index ? value : step)))
  }

  function addStep() {
    setSteps((current) => [...current, ''])
  }

  function removeStep(index: number) {
    setSteps((current) => current.filter((_, i) => i !== index))
  }

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

      const ingredients = ingredientRows.map((row) => ({
        amount: row.amount.trim() === '' ? null : Number(row.amount),
        unit: row.unit === 'annet' ? row.customUnit.trim() : row.unit,
        name: row.name.trim(),
      }))

      const { error: insertError } = await supabase.from('recipes').insert({
        title,
        ingredients,
        steps: steps.map((step) => step.trim()),
        image_url: imageUrl,
      })

      if (insertError) throw insertError

      setTitle('')
      setIngredientRows([emptyIngredientRow()])
      setSteps([''])
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

      <label>Ingredienser</label>
      <div className="ingredient-rows">
        {ingredientRows.map((row, index) => (
          <div className="ingredient-row" key={index}>
            <input
              className="ingredient-amount"
              type="number"
              min="0"
              step="any"
              placeholder="Mengde"
              value={row.amount}
              onChange={(e) => updateIngredientRow(index, { amount: e.target.value })}
            />
            <select
              className="ingredient-unit"
              value={row.unit}
              onChange={(e) => updateIngredientRow(index, { unit: e.target.value })}
            >
              {UNITS.map((unit) => (
                <option key={unit} value={unit}>
                  {unit}
                </option>
              ))}
              <option value="annet">annet</option>
            </select>
            {row.unit === 'annet' && (
              <input
                className="ingredient-custom-unit"
                placeholder="Enhet"
                value={row.customUnit}
                onChange={(e) => updateIngredientRow(index, { customUnit: e.target.value })}
              />
            )}
            <input
              className="ingredient-name"
              required
              placeholder="Ingrediens, f.eks. løk"
              value={row.name}
              onChange={(e) => updateIngredientRow(index, { name: e.target.value })}
            />
            <button
              type="button"
              className="row-remove"
              aria-label="Fjern ingrediens"
              onClick={() => removeIngredientRow(index)}
              disabled={ingredientRows.length === 1}
            >
              ✕
            </button>
          </div>
        ))}
      </div>
      <button type="button" className="row-add" onClick={addIngredientRow}>
        + Legg til ingrediens
      </button>

      <label>Fremgangsmåte</label>
      <div className="step-rows">
        {steps.map((step, index) => (
          <div className="step-row" key={index}>
            <span className="step-number">{index + 1}.</span>
            <textarea
              required
              rows={2}
              value={step}
              onChange={(e) => updateStep(index, e.target.value)}
            />
            <button
              type="button"
              className="row-remove"
              aria-label="Fjern steg"
              onClick={() => removeStep(index)}
              disabled={steps.length === 1}
            >
              ✕
            </button>
          </div>
        ))}
      </div>
      <button type="button" className="row-add" onClick={addStep}>
        + Legg til steg
      </button>

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
