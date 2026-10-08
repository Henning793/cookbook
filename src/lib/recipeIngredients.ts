import type { IngredientItem, RecipeComponent, RecipeIngredients } from '../types.ts'

// Ren modul (ingen supabase-/Vite-import) slik at den kan enhetstestes med
// vanlig `node --test`, på samme måte som shoppingAggregate.ts.

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function toItem(raw: Record<string, unknown>): IngredientItem {
  return {
    amount: typeof raw.amount === 'number' && Number.isFinite(raw.amount) ? raw.amount : null,
    unit: typeof raw.unit === 'string' ? raw.unit : '',
    name: typeof raw.name === 'string' ? raw.name : '',
  }
}

function toComponent(raw: unknown): RecipeComponent | null {
  if (!isRecord(raw)) return null
  const ingredients = Array.isArray(raw.ingredients)
    ? raw.ingredients.filter(isRecord).map(toItem)
    : []
  return { name: typeof raw.name === 'string' ? raw.name : '', ingredients }
}

// Tolker det som ligger i recipes.ingredients:
// - Nytt format: { loose, components }.
// - Gammelt format: flat liste der en rad med isHeading = true starter en
//   ny gruppe. Ingredienser før første overskrift blir løse, ingredienser
//   etter en overskrift hører til komponenten med det navnet.
// Databasen endres ikke; en oppskrift lagres i nytt format først når den redigeres.
export function normalizeIngredients(raw: unknown): RecipeIngredients {
  if (Array.isArray(raw)) {
    const loose: IngredientItem[] = []
    const components: RecipeComponent[] = []
    let current: RecipeComponent | null = null

    for (const entry of raw) {
      if (!isRecord(entry)) continue
      if (entry.isHeading === true) {
        current = { name: typeof entry.name === 'string' ? entry.name.trim() : '', ingredients: [] }
        components.push(current)
        continue
      }
      const item = toItem(entry)
      if (current) {
        current.ingredients.push(item)
      } else {
        loose.push(item)
      }
    }

    return { loose, components }
  }

  if (isRecord(raw)) {
    const loose = Array.isArray(raw.loose) ? raw.loose.filter(isRecord).map(toItem) : []
    const components = Array.isArray(raw.components)
      ? raw.components.map(toComponent).filter((c): c is RecipeComponent => c !== null)
      : []
    return { loose, components }
  }

  return { loose: [], components: [] }
}

// Alle ingredienser flatt: løse først, deretter komponentene i rekkefølge.
// Brukes av handleliste og søk, som ikke bryr seg om gruppering.
export function allIngredients(ingredients: RecipeIngredients): IngredientItem[] {
  return [...ingredients.loose, ...ingredients.components.flatMap((c) => c.ingredients)]
}

export function hasIngredients(ingredients: RecipeIngredients): boolean {
  return allIngredients(ingredients).length > 0
}

function norm(value: string): string {
  return value.trim().toLowerCase()
}

// Treffer navnet bare i begynnelsen av et ord, slik at "marinaden" treffer
// komponenten "Marinade" mens "soyasaus" ikke treffer komponenten "Saus".
function mentionsComponent(textLower: string, name: string): boolean {
  const needle = norm(name)
  if (!needle) return false
  let from = 0
  while (true) {
    const index = textLower.indexOf(needle, from)
    if (index === -1) return false
    if (index === 0 || !/[\p{L}\p{N}]/u.test(textLower[index - 1])) return true
    from = index + 1
  }
}

// Ingrediensnavn matches som før: nevnt hvor som helst i stegteksten.
function isNamed(textLower: string, name: string): boolean {
  const needle = norm(name)
  return needle !== '' && textLower.includes(needle)
}

export interface StepIngredientGroup {
  // null = løse ingredienser (utenfor komponenter)
  componentName: string | null
  items: IngredientItem[]
}

// Finner hva kokemodus skal vise under "Du trenger nå" for ett steg:
// 1. Nevner steget en komponent, vises ingrediensene fra den som steget
//    også nevner ved navn. Nevner det ingen av dem, vises alle i komponenten.
// 2. Ingrediensnavn i teksten vises fra de løse ingrediensene. Har en
//    nevnt komponent en ingrediens med samme navn, vinner komponentens.
// 3. Finnes en nevnt ingrediens bare inne i en komponent som ikke er nevnt,
//    vises den likevel (under komponentnavnet).
// Rekkefølge: løse først, så komponentene i oppskriftens rekkefølge.
export function ingredientsForStep(stepText: string, ingredients: RecipeIngredients): StepIngredientGroup[] {
  const text = stepText.toLowerCase()

  const mentioned = new Map<RecipeComponent, IngredientItem[]>()
  const shownInMentioned = new Set<string>()

  for (const component of ingredients.components) {
    if (!mentionsComponent(text, component.name)) continue
    const named = component.ingredients.filter((i) => isNamed(text, i.name))
    const items = named.length > 0 ? named : component.ingredients
    mentioned.set(component, items)
    for (const item of items) shownInMentioned.add(norm(item.name))
  }

  const looseItems = ingredients.loose.filter(
    (i) => isNamed(text, i.name) && !shownInMentioned.has(norm(i.name))
  )

  const handled = new Set([...shownInMentioned, ...looseItems.map((i) => norm(i.name))])

  const groups: StepIngredientGroup[] = []
  if (looseItems.length > 0) groups.push({ componentName: null, items: looseItems })

  for (const component of ingredients.components) {
    const items = mentioned.has(component)
      ? mentioned.get(component)!
      : component.ingredients.filter((i) => isNamed(text, i.name) && !handled.has(norm(i.name)))
    if (items.length > 0) groups.push({ componentName: component.name, items })
  }

  return groups
}

export function formatScaledAmount(item: IngredientItem, factor: number): string {
  if (item.amount == null) return ''
  const value = Math.round(item.amount * factor * 10) / 10
  return `${value.toLocaleString('nb-NO')} ${item.unit}`.trim()
}
