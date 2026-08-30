import { useState, type FormEvent } from 'react'
import { supabase } from '../lib/supabaseClient'
import { UNITS } from '../lib/units'
import type { IngredientItem } from '../types'

interface IngredientRow {
  amount: string
  unit: string
  customUnit: string
  name: string
}

const emptyIngredientRow = (): IngredientRow => ({ amount: '', unit: UNITS[0], customUnit: '', name: '' })

function moveItem<T>(items: T[], index: number, direction: -1 | 1): T[] {
  const target = index + direction
  if (target < 0 || target >= items.length) return items
  const copy = [...items]
  ;[copy[index], copy[target]] = [copy[target], copy[index]]
  return copy
}

function toIngredientRow(item: IngredientItem): IngredientRow {
  const isKnownUnit = (UNITS as readonly string[]).includes(item.unit)
  return {
    amount: item.amount == null ? '' : String(item.amount),
    unit: isKnownUnit ? item.unit : 'annet',
    customUnit: isKnownUnit ? '' : item.unit,
    name: item.name,
  }
}

export interface RecipeFormValues {
  title: string
  ingredients: IngredientItem[]
  steps: string[]
  image_url: string | null
}

interface Props {
  heading: string
  initial?: {
    title: string
    ingredients: IngredientItem[]
    steps: string[]
    image_url: string | null
  }
  submitLabel: string
  savingLabel: string
  onSubmit: (values: RecipeFormValues) => Promise<void>
  onCancel: () => void
  onDelete?: () => void
}

export function RecipeForm({ heading, initial, submitLabel, savingLabel, onSubmit, onCancel, onDelete }: Props) {
  const [title, setTitle] = useState(initial?.title ?? '')
  const [ingredientRows, setIngredientRows] = useState<IngredientRow[]>(
    initial && initial.ingredients.length > 0 ? initial.ingredients.map(toIngredientRow) : [emptyIngredientRow()]
  )
  const [steps, setSteps] = useState<string[]>(initial && initial.steps.length > 0 ? initial.steps : [''])
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  function updateIngredientRow(index: number, patch: Partial<IngredientRow>) {
    setIngredientRows((rows) => rows.map((row, i) => (i === index ? { ...row, ...patch } : row)))
  }

  function addIngredientRow() {
    setIngredientRows((rows) => [...rows, emptyIngredientRow()])
  }

  function removeIngredientRow(index: number) {
    setIngredientRows((rows) => rows.filter((_, i) => i !== index))
  }

  function moveIngredientRow(index: number, direction: -1 | 1) {
    setIngredientRows((rows) => moveItem(rows, index, direction))
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

  function moveStep(index: number, direction: -1 | 1) {
    setSteps((current) => moveItem(current, index, direction))
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError('')

    try {
      let imageUrl = initial?.image_url ?? null

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

      await onSubmit({
        title,
        ingredients,
        steps: steps.map((step) => step.trim()),
        image_url: imageUrl,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Noe gikk galt')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form className="add-recipe-form" onSubmit={handleSubmit}>
      <h2>{heading}</h2>

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
              className="ingredient-name"
              required
              placeholder="Ingrediens, f.eks. løk"
              value={row.name}
              onChange={(e) => updateIngredientRow(index, { name: e.target.value })}
            />
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
            <div className="row-actions">
              <button
                type="button"
                className="row-move"
                aria-label="Flytt ingrediens opp"
                onClick={() => moveIngredientRow(index, -1)}
                disabled={index === 0}
              >
                ↑
              </button>
              <button
                type="button"
                className="row-move"
                aria-label="Flytt ingrediens ned"
                onClick={() => moveIngredientRow(index, 1)}
                disabled={index === ingredientRows.length - 1}
              >
                ↓
              </button>
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
            <div className="row-actions">
              <button
                type="button"
                className="row-move"
                aria-label="Flytt steg opp"
                onClick={() => moveStep(index, -1)}
                disabled={index === 0}
              >
                ↑
              </button>
              <button
                type="button"
                className="row-move"
                aria-label="Flytt steg ned"
                onClick={() => moveStep(index, 1)}
                disabled={index === steps.length - 1}
              >
                ↓
              </button>
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
          </div>
        ))}
      </div>
      <button type="button" className="row-add" onClick={addStep}>
        + Legg til steg
      </button>

      <label htmlFor="image">
        {initial ? 'Nytt bilde (valgfritt, beholder eksisterende hvis tomt)' : 'Bilde (valgfritt)'}
      </label>
      <input
        id="image"
        type="file"
        accept="image/*"
        onChange={(e) => setImageFile(e.target.files?.[0] ?? null)}
      />

      {error && <p className="error">{error}</p>}

      <div className="form-actions">
        <button type="button" onClick={onCancel} disabled={saving}>
          Avbryt
        </button>
        <button type="submit" disabled={saving}>
          {saving ? savingLabel : submitLabel}
        </button>
      </div>

      {onDelete && (
        <button type="button" className="delete-recipe-button" onClick={onDelete} disabled={saving}>
          Slett oppskrift
        </button>
      )}
    </form>
  )
}
