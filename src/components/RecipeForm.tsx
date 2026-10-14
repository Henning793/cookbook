import { useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import { StepTimerField } from './StepTimerField'
import { stripTimerMarker, timerOverride, withTimerOverride } from '../lib/stepTimer'
import { Check, GripVertical, Plus } from 'lucide-react'
import { supabase } from '../lib/supabaseClient'
import { UNITS } from '../lib/units'
import { capitalizeFirst, capitalizeIngredients, componentSuggestions } from '../lib/recipeIngredients'
import { CustomUnitDialog } from './CustomUnitDialog'
import { useDragSort } from './useDragSort'
import { useApp } from '../context/AppContext'
import { recipeSuggestions } from '../lib/descriptionLinks'
import { moveBetweenGroups, moveTo, type SortPosition } from '../lib/reorder'
import type { IngredientItem, RecipeIngredients, RecipeKind } from '../types'

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

// Klassene som viser hvor en rad havner under dra-og-slipp. Posisjonene i
// målet regnes uten raden som dras (se useDragSort).
function sortItemClass(
  drag: { dragging: SortPosition | null; target: SortPosition | null },
  group: number,
  index: number
): string {
  const { dragging, target } = drag
  if (!dragging) return ''
  if (dragging.group === group && dragging.index === index) return ' sort-dragging'
  if (!target || target.group !== group) return ''
  if (target.group === dragging.group && target.index === dragging.index) return ''
  const position = dragging.group === group && index > dragging.index ? index - 1 : index
  return position === target.index ? ' sort-drop-before' : ''
}

function sortZoneClass(
  drag: { dragging: SortPosition | null; target: SortPosition | null },
  group: number,
  count: number
): string {
  const { dragging, target } = drag
  if (!dragging || !target || target.group !== group) return ''
  if (target.group === dragging.group && target.index === dragging.index) return ''
  const remaining = dragging.group === group ? count - 1 : count
  return target.index === remaining ? ' sort-drop-end' : ''
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

// Brukes som "steg" for @-autocomplete i beskrivelsen.
const DESCRIPTION = -1

interface Props {
  heading: string
  // En teknikk har ikke porsjoner eller etiketter, og «Du trenger» er valgfritt.
  kind: RecipeKind
  onKindChange: (kind: RecipeKind) => void
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
  kind,
  onKindChange,
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
  // Settes når man prøver å lagre uten etikett, og gjelder til én er valgt.
  const [tagsMissing, setTagsMissing] = useState(false)
  const tagLabelRef = useRef<HTMLLabelElement>(null)
  const tagPickerRef = useRef<HTMLDivElement>(null)
  const customTagInputRef = useRef<HTMLInputElement>(null)
  const stepRefs = useRef<(HTMLTextAreaElement | null)[]>([])
  const descriptionRef = useRef<HTMLTextAreaElement>(null)
  const { allRecipes, techniques } = useApp()
  // Åpen @-autocomplete: hvilket steg (DESCRIPTION for beskrivelsen), hvor "@"
  // står og hva som er skrevet etter.
  const [mention, setMention] = useState<{ step: number; start: number; end: number; query: string } | null>(null)
  const [mentionActive, setMentionActive] = useState(0)
  const [openTimer, setOpenTimer] = useState<number | null>(null)
  const [customUnitTarget, setCustomUnitTarget] = useState<{ group: number; row: number } | null>(null)

  const isTechnique = kind === 'technique'

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

  function moveIngredient(from: SortPosition, to: SortPosition) {
    setGroups((current) => moveBetweenGroups(current, from, to))
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
  // bare flyttes innbyrdes. Indeksene her teller bare komponentene.
  function moveComponent(from: number, to: number) {
    setGroups((current) => [current[0], ...moveTo(current.slice(1), from, to)])
  }

  // Tekstfeltet viser steget uten tidsmarkøren; markøren beholdes ved endring.
  function updateStep(index: number, value: string) {
    setSteps((current) => current.map((step, i) => (i === index ? withTimerOverride(value, timerOverride(step)) : step)))
  }

  function setStepTimer(index: number, minutes: number | null | undefined) {
    setSteps((current) => current.map((step, i) => (i === index ? withTimerOverride(step, minutes) : step)))
  }

  // Ser etter et "@" foran markøren (først i et ord, samme linje) og åpner
  // autocomplete med det som begynner med det som er skrevet: komponenter og
  // teknikker i stegene, oppskrifter i beskrivelsen (først etter første bokstav).
  function detectMention(index: number, text: string, caret: number) {
    const before = text.slice(0, caret)
    const at = before.lastIndexOf('@')
    const query = at === -1 ? '' : before.slice(at + 1)
    const startsWord = at === 0 || (at > 0 && !/[\p{L}\p{N}]/u.test(before[at - 1]))
    const tooShort = index === DESCRIPTION && query.trim() === ''
    if (at === -1 || !startsWord || tooShort || query.includes('\n') || query.length > 40) {
      setMention(null)
      return
    }
    setMention((current) => {
      if (!current || current.step !== index || current.start !== at) setMentionActive(0)
      return { step: index, start: at, end: caret, query }
    })
  }

  function chooseMention(index: number, name: string) {
    if (!mention) return
    const current = index === DESCRIPTION ? description : stripTimerMarker(steps[index] ?? '')
    const after = current.slice(mention.end)
    const inserted = '@' + name + (after === '' || /^[\s.,;:!?)]/.test(after) ? '' : ' ')
    const next = current.slice(0, mention.start) + inserted + (after === '' ? ' ' : after)
    if (index === DESCRIPTION) setDescription(next)
    else updateStep(index, next)
    setMention(null)
    const caret = mention.start + inserted.length + (after === '' ? 1 : 0)
    const textarea = index === DESCRIPTION ? descriptionRef.current : stepRefs.current[index]
    requestAnimationFrame(() => {
      textarea?.focus()
      textarea?.setSelectionRange(caret, caret)
    })
  }

  function handleStepKeyDown(index: number, e: KeyboardEvent<HTMLTextAreaElement>) {
    if (!mention || mention.step !== index || mentionOptions.length === 0) return
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      const delta = e.key === 'ArrowDown' ? 1 : -1
      setMentionActive((i) => (i + delta + mentionOptions.length) % mentionOptions.length)
    } else if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault()
      chooseMention(index, mentionOptions[Math.min(mentionActive, mentionOptions.length - 1)].name)
    } else if (e.key === 'Escape') {
      e.preventDefault()
      setMention(null)
    }
  }

  function addStep() {
    setSteps((current) => [...current, ''])
  }

  function removeStep(index: number) {
    setSteps((current) => current.filter((_, i) => i !== index))
  }

  function moveStep(from: number, to: number) {
    setOpenTimer(null)
    setMention(null)
    setSteps((current) => moveTo(current, from, to))
  }

  const ingredientDrag = useDragSort('ingredient', moveIngredient)
  const componentDrag = useDragSort('component', (from, to) => moveComponent(from.index, to.index))
  const stepDrag = useDragSort('step', (from, to) => moveStep(from.index, to.index))

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')

    if (!isTechnique && selectedTags.length === 0) {
      setTagsMissing(true)
      // Etikettene ligger langt nede i skjemaet, så feltet hentes fram og får fokus.
      tagLabelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      const target = tagPickerRef.current?.querySelector('button') ?? customTagInputRef.current
      target?.focus({ preventScroll: true })
      return
    }

    let servings: number | null = null
    if (!isTechnique && servingsInput.trim() !== '') {
      const parsed = Number(servingsInput.replace(',', '.'))
      if (Number.isNaN(parsed) || parsed <= 0) {
        setError('Antall porsjoner må være et tall større enn 0')
        return
      }
      servings = Math.round(parsed * 10) / 10
    }

    // I en teknikk er radene valgfrie, så tomme rader og tomme komponenter droppes.
    const filledGroups = isTechnique
      ? groups
          .map((group) => ({ ...group, rows: group.rows.filter((row) => row.name.trim() !== '') }))
          .filter((group, index) => index === 0 || group.rows.length > 0)
      : groups

    const totalRows = filledGroups.reduce((sum, group) => sum + group.rows.length, 0)
    if (!isTechnique && totalRows === 0) {
      setError('Legg til minst én ingrediens')
      return
    }
    const emptyComponent = filledGroups.slice(1).find((group) => group.rows.length === 0)
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

      // Navn og steg lagres med stor forbokstav ("løk" blir "Løk").
      const ingredients = capitalizeIngredients({
        loose: filledGroups[0].rows.map(toItem),
        components: filledGroups.slice(1).map((group) => ({
          name: (group.name ?? '').trim(),
          ingredients: group.rows.map(toItem),
        })),
      })

      await onSubmit({
        title,
        description: description.trim() === '' ? null : description.trim(),
        ingredients,
        steps: steps.map((step) => capitalizeFirst(step.trim())),
        image_url: imageUrl,
        tags: isTechnique ? [] : selectedTags,
        servings,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Noe gikk galt')
    } finally {
      setSaving(false)
    }
  }

  const componentNames = groups
    .slice(1)
    .map((group) => ({ name: (group.name ?? '').trim(), ingredients: [] }))
    .filter((component) => component.name !== '')
  // I stegene kommer komponentene først, så teknikkene fra kokeboka.
  const mentionOptions: { name: string; technique: boolean }[] = !mention
    ? []
    : mention.step === DESCRIPTION
      ? recipeSuggestions(mention.query, allRecipes, initial?.title).map((name) => ({ name, technique: false }))
      : [
          ...componentSuggestions(mention.query, { loose: [], components: componentNames }).map((c) => ({
            name: c.name,
            technique: false,
          })),
          ...recipeSuggestions(mention.query, techniques, initial?.title).map((name) => ({ name, technique: true })),
        ]

  function renderMentionList(index: number, label: string) {
    if (mention?.step !== index || mentionOptions.length === 0) return null
    return (
      <ul className="step-mention-list" role="listbox" aria-label={label}>
        {mentionOptions.map(({ name, technique }, optionIndex) => (
          <li key={(technique ? 't:' : 'c:') + name} role="option" aria-selected={optionIndex === mentionActive}>
            <button
              type="button"
              className={
                'step-mention-option' + (optionIndex === mentionActive ? ' step-mention-option-active' : '')
              }
              // mousedown i stedet for click, så tekstfeltet ikke mister fokus først
              onMouseDown={(e) => {
                e.preventDefault()
                chooseMention(index, name)
              }}
            >
              {name}
              {technique && <span className="step-mention-kind">Teknikk</span>}
            </button>
          </li>
        ))}
      </ul>
    )
  }

  const showTagError = tagsMissing && selectedTags.length === 0

  const customUnitRow = customUnitTarget === null ? null : groups[customUnitTarget.group]?.rows[customUnitTarget.row]

  function renderIngredientRow(groupIndex: number, rowIndex: number, row: IngredientRow) {
    return (
      <div
        className={'ingredient-row' + sortItemClass(ingredientDrag, groupIndex, rowIndex)}
        key={rowIndex}
        data-sort-item="ingredient"
      >
        <span
          className="drag-handle"
          aria-hidden="true"
          onPointerDown={(e) => ingredientDrag.startDrag(e, groupIndex, rowIndex)}
        >
          <GripVertical size={16} />
        </span>
        <input
          className="ingredient-name"
          required={!isTechnique}
          placeholder={isTechnique ? 'Utstyr eller råvare' : 'Ingrediens, f.eks. løk'}
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

      <div className="kind-switch" role="group" aria-label="Type">
        <button
          type="button"
          className={isTechnique ? 'kind-switch-option' : 'kind-switch-option kind-switch-option-active'}
          aria-pressed={!isTechnique}
          onClick={() => onKindChange('recipe')}
        >
          Oppskrift
        </button>
        <button
          type="button"
          className={isTechnique ? 'kind-switch-option kind-switch-option-active' : 'kind-switch-option'}
          aria-pressed={isTechnique}
          onClick={() => onKindChange('technique')}
        >
          Teknikk
        </button>
      </div>

      <label htmlFor="title">Tittel</label>
      <input
        id="title"
        required
        value={title}
        onChange={(e) => setTitle(e.target.value)}
      />

      <label htmlFor="description">
        {isTechnique ? 'Hva er det, og når bruker du det? (valgfritt)' : 'Beskrivelse (valgfritt)'}
      </label>
      <div className="step-input description-input">
        <textarea
          id="description"
          rows={2}
          ref={descriptionRef}
          placeholder={
            isTechnique
              ? 'En kort forklaring av teknikken'
              : 'En kort beskrivelse av retten. Skriv @ for å lenke til en annen oppskrift.'
          }
          value={description}
          onChange={(e) => {
            setDescription(e.target.value)
            detectMention(DESCRIPTION, e.target.value, e.target.selectionStart)
          }}
          onKeyDown={(e) => handleStepKeyDown(DESCRIPTION, e)}
          onBlur={() => setMention(null)}
        />
        {renderMentionList(DESCRIPTION, 'Oppskrifter')}
      </div>

      {!isTechnique && (
        <>
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
        </>
      )}

      <label>{isTechnique ? 'Du trenger (valgfritt)' : 'Ingredienser'}</label>
      {(groups[0].rows.length > 0 || ingredientDrag.dragging) && (
        <div
          className={
            'ingredient-rows' +
            (groups[0].rows.length === 0 ? ' sort-zone-empty' : '') +
            sortZoneClass(ingredientDrag, 0, groups[0].rows.length)
          }
          data-sort-zone="ingredient"
          data-sort-group={0}
        >
          {groups[0].rows.map((row, rowIndex) => renderIngredientRow(0, rowIndex, row))}
        </div>
      )}
      <div className="row-add-group">
        <button type="button" className="row-add" onClick={() => addIngredientRow(0)}>
          {isTechnique ? '+ Legg til rad' : '+ Legg til ingrediens'}
        </button>
        <button type="button" className="row-add" onClick={addComponent}>
          + Legg til komponent
        </button>
      </div>

      <div className={'component-cards' + sortZoneClass(componentDrag, 0, groups.length - 1)} data-sort-zone="component">
      {groups.slice(1).map((group, offset) => {
        const groupIndex = offset + 1
        return (
          <div
            className={'component-card' + sortItemClass(componentDrag, 0, offset)}
            key={groupIndex}
            data-sort-item="component"
          >
            <div className="component-card-header">
              <span
                className="drag-handle"
                aria-hidden="true"
                onPointerDown={(e) => componentDrag.startDrag(e, 0, offset)}
              >
                <GripVertical size={16} />
              </span>
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
                  className="row-remove"
                  aria-label="Fjern komponent"
                  onClick={() => removeComponent(groupIndex)}
                >
                  ✕
                </button>
              </div>
            </div>
            <div
              className={
                'ingredient-rows' +
                (group.rows.length === 0 ? ' sort-zone-empty' : '') +
                sortZoneClass(ingredientDrag, groupIndex, group.rows.length)
              }
              data-sort-zone="ingredient"
              data-sort-group={groupIndex}
            >
              {group.rows.map((row, rowIndex) => renderIngredientRow(groupIndex, rowIndex, row))}
            </div>
            <button type="button" className="row-add" onClick={() => addIngredientRow(groupIndex)}>
              + Legg til ingrediens i {group.name?.trim() || 'komponenten'}
            </button>
          </div>
        )
      })}
      </div>

      <label>Fremgangsmåte</label>
      {(componentNames.length > 0 || techniques.length > 0) && (
        <p className="step-mention-hint">
          {componentNames.length > 0 && techniques.length > 0
            ? 'Skriv @ for å koble et steg til en komponent eller en teknikk. En komponent styrer hvilke ingredienser som vises, en teknikk blir en lenke i steget.'
            : componentNames.length > 0
              ? 'Skriv @ for å koble et steg til en komponent. Da hentes ingrediensene bare derfra.'
              : 'Skriv @ for å koble et steg til en teknikk. Den blir en lenke i steget.'}
        </p>
      )}
      <div className={'step-rows' + sortZoneClass(stepDrag, 0, steps.length)} data-sort-zone="step">
        {steps.map((step, index) => (
          <div className={'step-row' + sortItemClass(stepDrag, 0, index)} key={index} data-sort-item="step">
            <span className="drag-handle" aria-hidden="true" onPointerDown={(e) => stepDrag.startDrag(e, 0, index)}>
              <GripVertical size={16} />
            </span>
            <span className="step-number">{index + 1}.</span>
            <div className="step-input">
              <textarea
                required
                rows={2}
                value={stripTimerMarker(step)}
                ref={(element) => {
                  stepRefs.current[index] = element
                }}
                onChange={(e) => {
                  updateStep(index, e.target.value)
                  detectMention(index, e.target.value, e.target.selectionStart)
                }}
                onKeyDown={(e) => handleStepKeyDown(index, e)}
                onBlur={() => setMention(null)}
              />
              {renderMentionList(index, 'Komponenter og teknikker')}
              <StepTimerField
                step={step}
                open={openTimer === index}
                onOpen={() => setOpenTimer(index)}
                onClose={() => setOpenTimer(null)}
                onChange={(minutes) => setStepTimer(index, minutes)}
              />
            </div>
            <div className="row-actions">
              <button
                type="button"
                className="row-remove"
                aria-label="Fjern steg"
                onClick={() => {
                  setOpenTimer(null)
                  removeStep(index)
                }}
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

      {!isTechnique && (
        <>
          <label id="tags-label" ref={tagLabelRef} className={showTagError ? 'field-label-invalid' : undefined}>
            Etiketter (velg minst én)
          </label>
          <div
            className={showTagError ? 'tag-picker tag-picker-invalid' : 'tag-picker'}
            ref={tagPickerRef}
            role="group"
            aria-labelledby="tags-label"
            aria-describedby={showTagError ? 'tags-error' : undefined}
          >
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
          {showTagError && (
            <p className="error field-error" id="tags-error" role="alert">
              Du må velge minst én etikett før oppskriften kan lagres.
            </p>
          )}
          <div className="tag-add-row">
            <input
              ref={customTagInputRef}
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
        </>
      )}

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
          {isTechnique ? 'Slett teknikk' : 'Slett oppskrift'}
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
        onPickStandard={
          customUnitRow.unit === 'annet'
            ? (unit) => {
                updateIngredientRow(customUnitTarget.group, customUnitTarget.row, { unit, customUnit: '' })
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
