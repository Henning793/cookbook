import { useState, type FormEvent } from 'react'
import { Check, Plus } from 'lucide-react'
import { supabase } from '../lib/supabaseClient'
import { UNITS } from '../lib/units'
import type { IngredientItem } from '../types'

interface IngredientRow {
  amount: string
  unit: string
  customUnit: string
  name: string
  isHeading: boolean
}

const emptyIngredientRow = (): IngredientRow => ({
  amount: '',
  unit: UNITS[0],
  customUnit: '',
  name: '',
  isHeading: false,
})

const emptyHeadingRow = (): IngredientRow => ({
  amount: '',
  unit: UNITS[0],
  customUnit: '',
  name: '',
  isHeading: true,
})

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
    isHeading: item.isHeading ?? false,
  }
}

export interface RecipeFormValues {
  title: string
  ingredients: IngredientItem[]
  steps: string[]
  image_url: string | null
  tags: string[]
}

interface Props {
  heading: string
  initial?: {
    title: string
    ingredients: IngredientItem[]
    steps: string[]
    image_url: string | null
    tags: string[]
  }
  availableTags: string[]
  submitLabel: string
  savingLabel: string
  onSubmit: (values: RecipeFormValues) => Promise<void>
  onCancel: () => void
  onDelete?: () => void
}

export function RecipeForm({
  heading,
  initial,
  availableTags,
  submitLabel,
  savingLabel,
  onSubmit,
  onCancel,
  onDelete,
}: Props) {
  const [title, setTitle] = useState(initial?.title ?? '')
  const [ingredientRows, setIngredientRows] = useState<IngredientRow[]>(
    initial && initial.ingredients.length > 0 ? initial.ingredients.map(toIngredientRow) : [emptyIngredientRow()]
  )
  const [steps, setSteps] = useState<string[]>(initial && initial.steps.length > 0 ? initial.steps : [''])
  const [selectedTags, setSelectedTags] = useState<string[]>(initial?.tags ?? [])
  const [customTagOptions, setCustomTagOptions] = useState<string[]>([])
  const [customTagInput, setCustomTagInput] = useState('')
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const tagOptions = [...new Set([...availableTags, ...customTagOptions])]

  function toggleTag(tag: string) {
    setSelectedTags((tags) => (tags.includes(tag) ? tags.filter((t) => t !== tag) : [...tags, tag]))
  }

  function addCustomTag() {
    const tag = customTagInput.trim()
    if (!tag) return
    setCustomTagOptions((tags) => (tags.includes(tag) ? tags : [...tags, tag]))
    setSelectedTags((tags) => (tags.includes(tag) ? tags : [...tags, tag]))
    setCustomTagInput('')
  }

  function updateIngredientRow(index: number, patch: Partial<IngredientRow>) {
    setIngredientRows((rows) => rows.map((row, i) => (i === index ? { ...row, ...patch } : row)))
  }

  function addIngredientRow() {
    setIngredientRows((rows) => [...rows, emptyIngredientRow()])
  }

  function addHeadingRow() {
    setIngredientRows((rows) => [...rows, emptyHeadingRow()])
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

      const ingredients = ingredientRows.map((row) =>
        row.isHeading
          ? { amount: null, unit: '', name: row.name.trim(), isHeading: true }
          : {
              amount: row.amount.trim() === '' ? null : Number(row.amount),
              unit: row.unit === 'annet' ? row.customUnit.trim() : row.unit,
              name: row.name.trim(),
            }
      )

      await onSubmit({
        title,
        ingredients,
        steps: steps.map((step) => step.trim()),
        image_url: imageUrl,
        tags: selectedTags,
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
          <div className={row.isHeading ? 'ingredient-row ingredient-row-heading' : 'ingredient-row'} key={index}>
            {row.isHeading ? (
              <input
                className="ingredient-heading-input"
                required
                placeholder="Overskrift, f.eks. Til marinaden"
                value={row.name}
                onChange={(e) => updateIngredientRow(index, { name: e.target.value })}
              />
            ) : (
              <>
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
              </>
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
      <div className="row-add-group">
        <button type="button" className="row-add" onClick={addIngredientRow}>
          + Legg til ingrediens
        </button>
        <button type="button" className="row-add" onClick={addHeadingRow}>
          + Legg til overskrift
        </button>
      </div>

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

      <label>Etiketter</label>
      <div className="tag-picker">
        {tagOptions.map((tag) => {
          const selected = selectedTags.includes(tag)
          return (
            <button
              type="button"
              key={tag}
              className={selected ? 'tag-option tag-option-selected' : 'tag-option'}
              aria-pressed={selected}
              onClick={() => toggleTag(tag)}
            >
              {selected && (
                <Check size={12} strokeWidth={2.75} className="tag-option-check" aria-hidden="true" />
              )}
              {tag}
            </button>
          )
        })}
      </div>
      <div className="tag-add-row">
        <input
          placeholder="Legg til egen etikett"
          value={customTagInput}
          onChange={(e) => setCustomTagInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              addCustomTag()
            }
          }}
        />
        <button type="button" className="row-add" onClick={addCustomTag}>
          + Legg til
        </button>
      </div>

      <label className="image-upload-row" htmlFor="image">
        <span className="image-upload-icon" aria-hidden="true">
          <Plus size={14} strokeWidth={2.75} />
        </span>
        <span className="image-upload-label">
          {imageFile
            ? imageFile.name
            : initial
              ? 'Nytt bilde (valgfritt, beholder eksisterende hvis tomt)'
              : 'Legg til bilde'}
        </span>
        <input
          id="image"
          type="file"
          accept="image/*"
          className="visually-hidden"
          onChange={(e) => setImageFile(e.target.files?.[0] ?? null)}
        />
      </label>

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
