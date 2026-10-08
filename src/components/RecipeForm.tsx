import { useState, type FormEvent } from 'react'
import { Check, Plus } from 'lucide-react'
import { supabase } from '../lib/supabaseClient'
import { UNITS } from '../lib/units'
import { CustomUnitDialog } from './CustomUnitDialog'
import type { IngredientItem, RecipeIngredients } from '../types'

interface IngredientRow {
  amount: string
  unit: string
  customUnit: string
  name: string
}

// Gruppe 0 er alltid de løse ingrediensene (name = null). Gruppe 1 og
// utover er komponenter (f.eks. Marinade) med eget navn og egne ingredienser.
interface IngredientGroup {
  name: string | null
  rows: IngredientRow[]
}

const emptyIngredientRow = (): IngredientRow => ({
  amount: '',
  unit: UNITS[0],
  customUnit: '',
  name: '',
})

function toItem(row: IngredientRow): IngredientItem {
  return {
    amount: row.amount.trim() === '' ? null : Number(row.amount),
    unit: row.unit === 'annet' ? row.customUnit.trim() : row.unit,
    name: row.name.trim(),
  }
}

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

function toGroups(ingredients: RecipeIngredients | undefined): IngredientGroup[] {
  const loose = ingredients?.loose ?? []
  const components = ingredients?.components ?? []
  const looseRows = loose.map(toIngredientRow)
  // Et helt tomt skjema starter med én tom løs ingrediensrad, som før.
  const startRows = looseRows.length === 0 && components.length === 0 ? [emptyIngredientRow()] : looseRows
  return [
    { name: null, rows: startRows },
    ...components.map((c) => ({ name: c.name, rows: c.ingredients.map(toIngredientRow) })),
  ]
}

export interface RecipeFormValues {
  title: string
  description: string | null
  ingredients: RecipeIngredients
  steps: string[]
  image_url: string | null
  tags: string[]
  servings: number | null
}

interface Props {
  heading: string
  initial?: {
    title: string
    description?: string | null
    ingredients: RecipeIngredients
    steps: string[]
    image_url: string | null
    tags: string[]
    servings: number | null
  }
  availableTags: string[]
  submitLabel: string
  savingLabel: string
  onSubmit: (values: RecipeFormValues) => Promise<void>
  onCancel: () => void
  onDelete?: () => void
  saveAtBottom?: boolean
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
  saveAtBottom = false,
}: Props) {
  const [title, setTitle] = useState(initial?.title ?? '')
  const [description, setDescription] = useState(initial?.description ?? '')
  const [groups, setGroups] = useState<IngredientGroup[]>(() => toGroups(initial?.ingredients))
  const [steps, setSteps] = useState<string[]>(initial && initial.steps.length > 0 ? initial.steps : [''])
  const [servingsInput, setServingsInput] = useState(
    initial?.servings != null ? String(initial.servings) : ''
  )
  const [selectedTags, setSelectedTags] = useState<string[]>(initial?.tags ?? [])
  const [customTagOptions, setCustomTagOptions] = useState<string[]>([])
  const [customTagInput, setCustomTagInput] = useState('')
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [customUnitTarget, setCustomUnitTarget] = useState<{ group: number; row: number } | null>(null)

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

  function updateGroup(groupIndex: number, patch: (group: IngredientGroup) => IngredientGroup) {
    setGroups((current) => current.map((group, i) => (i === groupIndex ? patch(group) : group)))
  }

  function updateIngredientRow(groupIndex: number, rowIndex: number, patch: Partial<IngredientRow>) {
    updateGroup(groupIndex, (group) => ({
      ...group,
      rows: group.rows.map((row, i) => (i === rowIndex ? { ...row, ...patch } : row)),
    }))
  }

  function addIngredientRow(groupIndex: number) {
    updateGroup(groupIndex, (group) => ({ ...group, rows: [...group.rows, emptyIngredientRow()] }))
  }

  function removeIngredientRow(groupIndex: number, rowIndex: number) {
    updateGroup(groupIndex, (group) => ({ ...group, rows: group.rows.filter((_, i) => i !== rowIndex) }))
  }

  function moveIngredientRow(groupIndex: number, rowIndex: number, direction: -1 | 1) {
    updateGroup(groupIndex, (group) => ({ ...group, rows: moveItem(group.rows, rowIndex, direction) }))
  }

  function addComponent() {
    setGroups((current) => [...current, { name: '', rows: [emptyIngredientRow()] }])
  }

  function renameComponent(groupIndex: number, name: string) {
    updateGroup(groupIndex, (group) => ({ ...group, name }))
  }

  function removeComponent(groupIndex: number) {
    setGroups((current) => current.filter((_, i) => i !== groupIndex))
  }

  // Gruppe 0 (løse ingredienser) ligger fast øverst, så komponenter kan
  // bare flyttes innbyrdes (indeks 1 og oppover).
  function moveComponent(groupIndex: number, direction: -1 | 1) {
    setGroups((current) => {
      const target = groupIndex + direction
      if (target < 1 || target >= current.length) return current
      return moveItem(current, groupIndex, direction)
    })
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
    setError('')

    if (selectedTags.length === 0) {
      setError('Velg minst én etikett')
      return
    }

    let servings: number | null = null
    if (servingsInput.trim() !== '') {
      const parsed = Number(servingsInput.replace(',', '.'))
      if (Number.isNaN(parsed) || parsed <= 0) {
        setError('Antall porsjoner må være et tall større enn 0')
        return
      }
      servings = Math.round(parsed * 10) / 10
    }

    const totalRows = groups.reduce((sum, group) => sum + group.rows.length, 0)
    if (totalRows === 0) {
      setError('Legg til minst én ingrediens')
      return
    }
    const emptyComponent = groups.slice(1).find((group) => group.rows.length === 0)
    if (emptyComponent) {
      setError(`Komponenten «${emptyComponent.name?.trim() || 'uten navn'}» trenger minst én ingrediens`)
      return
    }

    setSaving(true)

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

      const ingredients: RecipeIngredients = {
        loose: groups[0].rows.map(toItem),
        components: groups.slice(1).map((group) => ({
          name: (group.name ?? '').trim(),
          ingredients: group.rows.map(toItem),
        })),
      }

      await onSubmit({
        title,
        description: description.trim() === '' ? null : description.trim(),
        ingredients,
        steps: steps.map((step) => step.trim()),
        image_url: imageUrl,
        tags: selectedTags,
        servings,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Noe gikk galt')
    } finally {
      setSaving(false)
    }
  }

  const customUnitRow = customUnitTarget === null ? null : groups[customUnitTarget.group]?.rows[customUnitTarget.row]

  function renderIngredientRow(groupIndex: number, rowIndex: number, row: IngredientRow) {
    const rowCount = groups[groupIndex].rows.length
    return (
      <div className="ingredient-row" key={rowIndex}>
        <input
          className="ingredient-name"
          required
          placeholder="Ingrediens, f.eks. løk"
          value={row.name}
          onChange={(e) => updateIngredientRow(groupIndex, rowIndex, { name: e.target.value })}
        />
        <input
          className="ingredient-amount"
          type="number"
          min="0"
          step="any"
          placeholder="Mengde"
          value={row.amount}
          onChange={(e) => updateIngredientRow(groupIndex, rowIndex, { amount: e.target.value })}
        />
        {row.unit === 'annet' ? (
          <button
            type="button"
            className="ingredient-unit-chip"
            aria-label="Rediger egendefinert enhet"
            onClick={() => setCustomUnitTarget({ group: groupIndex, row: rowIndex })}
          >
            <span className="ingredient-unit-chip-text">{row.customUnit || '–'}</span>
            <span aria-hidden="true">›</span>
          </button>
        ) : (
          <select
            className="ingredient-unit"
            value={row.unit}
            onChange={(e) =>
              e.target.value === 'annet'
                ? setCustomUnitTarget({ group: groupIndex, row: rowIndex })
                : updateIngredientRow(groupIndex, rowIndex, { unit: e.target.value })
            }
          >
            {UNITS.map((unit) => (
              <option key={unit} value={unit}>
                {unit}
              </option>
            ))}
            <option value="annet">annet</option>
          </select>
        )}
        <div className="row-actions">
          <button
            type="button"
            className="row-move"
            aria-label="Flytt ingrediens opp"
            onClick={() => moveIngredientRow(groupIndex, rowIndex, -1)}
            disabled={rowIndex === 0}
          >
            ↑
          </button>
          <button
            type="button"
            className="row-move"
            aria-label="Flytt ingrediens ned"
            onClick={() => moveIngredientRow(groupIndex, rowIndex, 1)}
            disabled={rowIndex === rowCount - 1}
          >
            ↓
          </button>
          <button
            type="button"
            className="row-remove"
            aria-label="Fjern ingrediens"
            onClick={() => removeIngredientRow(groupIndex, rowIndex)}
          >
            ✕
          </button>
        </div>
      </div>
    )
  }

  return (
    <>
    <form className="add-recipe-form" onSubmit={handleSubmit}>
      <h2>{heading}</h2>

      <label htmlFor="title">Tittel</label>
      <input
        id="title"
        required
        value={title}
        onChange={(e) => setTitle(e.target.value)}
      />

      <label htmlFor="description">Beskrivelse (valgfritt)</label>
      <textarea
        id="description"
        rows={2}
        placeholder="En kort beskrivelse av retten"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
      />

      <label htmlFor="servings">Antall porsjoner</label>
      <input
        id="servings"
        type="number"
        min="1"
        step="0.1"
        placeholder="1"
        value={servingsInput}
        onChange={(e) => setServingsInput(e.target.value)}
      />

      <label>Ingredienser</label>
      {groups[0].rows.length > 0 && (
        <div className="ingredient-rows">
          {groups[0].rows.map((row, rowIndex) => renderIngredientRow(0, rowIndex, row))}
        </div>
      )}
      <div className="row-add-group">
        <button type="button" className="row-add" onClick={() => addIngredientRow(0)}>
          + Legg til ingrediens
        </button>
        <button type="button" className="row-add" onClick={addComponent}>
          + Legg til komponent
        </button>
      </div>

      {groups.slice(1).map((group, offset) => {
        const groupIndex = offset + 1
        return (
          <div className="component-card" key={groupIndex}>
            <div className="component-card-header">
              <input
                className="ingredient-heading-input"
                required
                aria-label="Navn på komponent"
                placeholder="Komponent, f.eks. Marinade"
                value={group.name ?? ''}
                onChange={(e) => renameComponent(groupIndex, e.target.value)}
              />
              <div className="row-actions">
                <button
                  type="button"
                  className="row-move"
                  aria-label="Flytt komponent opp"
                  onClick={() => moveComponent(groupIndex, -1)}
                  disabled={groupIndex === 1}
                >
                  ↑
                </button>
                <button
                  type="button"
                  className="row-move"
                  aria-label="Flytt komponent ned"
                  onClick={() => moveComponent(groupIndex, 1)}
                  disabled={groupIndex === groups.length - 1}
                >
                  ↓
                </button>
                <button
                  type="button"
                  className="row-remove"
                  aria-label="Fjern komponent"
                  onClick={() => removeComponent(groupIndex)}
                >
                  ✕
                </button>
              </div>
            </div>
            <div className="ingredient-rows">
              {group.rows.map((row, rowIndex) => renderIngredientRow(groupIndex, rowIndex, row))}
            </div>
            <button type="button" className="row-add" onClick={() => addIngredientRow(groupIndex)}>
              + Legg til ingrediens i {group.name?.trim() || 'komponenten'}
            </button>
          </div>
        )
      })}

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

      <label>Etiketter (velg minst én)</label>
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
        {!saveAtBottom && (
          <button type="submit" disabled={saving}>
            {saving ? savingLabel : submitLabel}
          </button>
        )}
      </div>

      {saveAtBottom && (
        <div className="form-save-bar">
          <button type="submit" disabled={saving}>
            {saving ? savingLabel : submitLabel}
          </button>
        </div>
      )}

      {onDelete && (
        <button type="button" className="delete-recipe-button" onClick={onDelete} disabled={saving}>
          Slett oppskrift
        </button>
      )}
    </form>

    {customUnitTarget !== null && customUnitRow && (
      <CustomUnitDialog
        initialValue={customUnitRow.unit === 'annet' ? customUnitRow.customUnit : ''}
        onConfirm={(unit) => {
          updateIngredientRow(customUnitTarget.group, customUnitTarget.row, { unit: 'annet', customUnit: unit })
          setCustomUnitTarget(null)
        }}
        onUseStandard={
          customUnitRow.unit === 'annet'
            ? () => {
                updateIngredientRow(customUnitTarget.group, customUnitTarget.row, { unit: UNITS[0], customUnit: '' })
                setCustomUnitTarget(null)
              }
            : undefined
        }
        onClose={() => setCustomUnitTarget(null)}
      />
    )}
    </>
  )
}
