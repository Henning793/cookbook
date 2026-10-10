import type { IngredientItem, RecipeComponent, RecipeIngredients } from '../types.ts'
import { stripTimerMarker } from './stepTimer.ts'

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
function mentionsAtWordStart(textLower: string, name: string): boolean {
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

// Koblinger i stegtekst: "@Komponent", f.eks. "støv formen med mel fra
// @Støving av form". Teksten forblir en vanlig streng, så det trengs ingen
// skjemaendring. Lengste navn vinner, så "@Saus til servering" ikke tolkes
// som "@Saus" når begge finnes.
export type StepSegment = { text: string; component: RecipeComponent | null }

// Korte vanlige ord som ellers kunne treffet slutten av et ingrediensnavn.
const STOP_WORDS = new Set(['med', 'til', 'den', 'det', 'som', 'for', 'har', 'kan', 'ned', 'opp', 'inn', 'alt', 'all', 'men', 'mer', 'nok'])
// Ord i stegteksten som ikke betyr en ingrediens, selv om et ingrediensnavn
// slutter på dem. Hele navnet ("soyasausen", "lasagneplatene") treffer fortsatt.
const DISH_WORDS = new Set([
  // Det man lager: "la sausen redusere" skal ikke hente soyasaus og fiskesaus.
  'saus', 'deig', 'røre', 'suppe', 'gryte', 'blanding', 'fyll', 'glasur', 'marinade', 'dressing', 'lake', 'masse', 'farse',
  'krem', 'kake', 'kaker', 'bunn', 'stuing', 'pasta',
  // Redskap og former: "legg på en plate" skal ikke hente lasagneplater, og
  // "skjær i terninger" skal ikke hente buljongterning.
  'plate', 'plater', 'bolle', 'boller', 'bit', 'skive', 'skiver', 'terning', 'strimmel', 'strimle', 'strimler', 'båt',
])
// Ingredienser som ikke er en variant av det siste leddet i navnet: "løk" i
// et steg betyr rødløk eller gul løk, aldri hvitløk, og "melk" er aldri kokosmelk.
const NOT_A_VARIANT = new Set(['hvitløk', 'kokosmelk', 'peanøttsmør', 'muskatnøtt', 'cayennepepper', 'sitronpepper'])
const MIN_LENGTH = 3
const MIN_COMPOUND_PREFIX = 2
const MIN_STEM_ENDING = 4
const INFLECTIONS = new Set(['', 'e', 'n', 't', 'a', 'en', 'et', 'er', 'ne', 'te', 'ene', 'ane', 'ens', 'ets'])

// Ordet med og uten bøyningsendelse, så "melet", "oljen" og "bananene"
// kan sammenlignes med "mel", "olje" og "bananer".
function stems(word: string): string[] {
  const result = new Set([word])
  for (const ending of INFLECTIONS) {
    if (ending && word.endsWith(ending) && word.length - ending.length >= MIN_LENGTH) {
      result.add(word.slice(0, -ending.length))
    }
  }
  return [...result]
}

// Hvor i stegteksten en ingrediens er nevnt (startposisjonen til ordet),
// delt i treff på hele navnet og løsere treff.
// Ingredienslisten er ofte mer presis enn fremgangsmåten, så det er tilgivende:
// - hele navnet, også bøyd ("løkpulveret" treffer "løkpulver")
// - siste ord i navnet, også bøyd ("oljen" treffer "nøytral olje", "bananene"
//   treffer "modne bananer")
// - et ord i teksten som er siste ledd i navnet ("mel" treffer "hvetemel")
interface Positions {
  exact: number[]
  loose: number[]
}

function ingredientPositions(textLower: string, name: string): Positions {
  const exact = new Set<number>()
  const loose = new Set<number>()

  for (const needle of nameVariants(name)) {
    let from = 0
    while (true) {
      const index = textLower.indexOf(needle, from)
      if (index === -1) break
      from = index + 1
      if (index > 0 && isWordChar(textLower[index - 1])) continue
      // Resten av ordet må være en bøyning ("smøret"), ikke et nytt ord
      // ("melblandingen" skal ikke treffe "mel").
      const rest = /^[\p{L}\p{N}]*/u.exec(textLower.slice(index + needle.length))?.[0] ?? ''
      if (INFLECTIONS.has(rest)) exact.add(index)
    }
  }

  for (const needle of nameVariants(name)) {
    const tail = needle.split(/[^\p{L}\p{N}]+/u).filter(Boolean).pop() ?? ''
    if (tail.length < MIN_LENGTH) continue
    const tailStems = stems(tail)
    for (const match of textLower.matchAll(/[\p{L}\p{N}]+/gu)) {
      const word = match[0]
      if (word.length < MIN_LENGTH) continue
      const wordStems = stems(word)
      const compound = !wordStems.some((w) => DISH_WORDS.has(w))
      const hit = wordStems.some(
        (w) =>
          tailStems.includes(w) ||
          (compound && !STOP_WORDS.has(w) && w.length >= MIN_LENGTH && isCompoundEnding(tail, tailStems, w))
      )
      const index = match.index ?? 0
      if (hit && !exact.has(index)) loose.add(index)
    }
  }

  return { exact: [...exact], loose: [...loose] }
}

// Selve varen i et ingrediensnavn, uten tillegg om tilberedning og bruk:
// "ristede peanøtter, grovhakket" er "ristede peanøtter", "smør til steking"
// er "smør", og "bacon eller pancetta" er både "bacon" og "pancetta".
function nameVariants(name: string): string[] {
  const head = norm(name).split(/[,(]/)[0]
  return head
    .split(/\s+eller\s+/)
    .map((part) => part.split(/\s+(?:til|i|uten)\s+/)[0].trim())
    .filter(Boolean)
}

// Om `word` er siste ledd i det sammensatte ordet `tail`: "mel" i "hvetemel".
// Leddet foran må være minst to bokstaver, så "mør" ikke treffer "smør".
// Mot en bøyd utgave av navnet ("mandelpotet" for "mandelpoteter") må ordet
// være lengre, så "ett" (fra "etter") ikke treffer "pancett" (fra "pancetta").
function isCompoundEnding(tail: string, tailStems: string[], word: string): boolean {
  if (tailStems.some((stem) => NOT_A_VARIANT.has(stem))) return false
  const endsWith = (whole: string) => whole.endsWith(word) && whole.length - word.length >= MIN_COMPOUND_PREFIX
  return endsWith(tail) || (word.length >= MIN_STEM_ENDING && tailStems.some(endsWith))
}

function isMentioned(textLower: string, name: string): boolean {
  const { exact, loose } = ingredientPositions(textLower, name)
  return exact.length + loose.length > 0
}

// Ord som betyr at steget gjelder hele komponenten, selv om bare noen av
// ingrediensene er nevnt ved navn: "Bland sammen alle ingrediensene til
// dressingen og press i hvitløk" skal vise hele dressingen, ikke bare hvitløk.
const WHOLE_COMPONENT = /(^|[^\p{L}\p{N}])(ingrediens\p{L}*|alt|resten)(?![\p{L}\p{N}])/u

function meansWholeComponent(textLower: string): boolean {
  return WHOLE_COMPONENT.test(textLower)
}

function isWordChar(char: string | undefined): boolean {
  return char !== undefined && /[\p{L}\p{N}]/u.test(char)
}

function componentAt(stepText: string, index: number, ingredients: RecipeIngredients): RecipeComponent | null {
  const rest = stepText.slice(index).toLowerCase()
  let best: RecipeComponent | null = null
  for (const component of ingredients.components) {
    const name = norm(component.name)
    if (!name || !rest.startsWith(name) || isWordChar(rest[name.length])) continue
    if (!best || name.length > norm(best.name).length) best = component
  }
  return best
}

// Deler stegteksten i vanlig tekst og @-koblinger. Ukjente @-ord blir
// stående som tekst.
export function parseStep(stepText: string, ingredients: RecipeIngredients): StepSegment[] {
  const segments: StepSegment[] = []
  let last = 0
  let at = stepText.indexOf('@')
  while (at !== -1) {
    const component = isWordChar(stepText[at - 1]) ? null : componentAt(stepText, at + 1, ingredients)
    if (component) {
      if (at > last) segments.push({ text: stepText.slice(last, at), component: null })
      const end = at + 1 + component.name.trim().length
      segments.push({ text: stepText.slice(at + 1, end), component })
      last = end
    }
    at = stepText.indexOf('@', component ? last : at + 1)
  }
  if (last < stepText.length) segments.push({ text: stepText.slice(last), component: null })
  return segments
}

// Stegteksten slik den leses: @-koblinger er bare for kokemodus og fjernes,
// sammen med mellomrommet de etterlater. Det samme gjelder tidsmarkøren
// ("{tid:25}") fra redigeringsskjemaet.
export function stepDisplayText(stepText: string, ingredients: RecipeIngredients): string {
  return parseStep(stripTimerMarker(stepText), ingredients)
    .filter((s) => !s.component)
    .map((s) => s.text)
    .join('')
    .replace(/\(\s*\)/g, '')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/ +([.,;:!?)])/g, '$1')
    .replace(/\( +/g, '(')
    .trim()
}

// Forslag til autocomplete: komponenter der navnet begynner med det som er
// skrevet etter "@".
export function componentSuggestions(query: string, ingredients: RecipeIngredients): RecipeComponent[] {
  const q = query.toLowerCase().trimStart()
  return ingredients.components.filter((c) => norm(c.name) !== '' && norm(c.name).startsWith(q))
}

export interface StepIngredientGroup {
  // null = løse ingredienser (utenfor komponenter)
  componentName: string | null
  items: IngredientItem[]
}

// Finner hva kokemodus skal vise under "Du trenger nå" for ett steg.
// Har steget @-koblinger, hentes ingrediensene bare fra de koblede
// komponentene: de som er nevnt ved navn i teksten, eller hele komponenten
// hvis ingen er nevnt eller steget sier "ingrediensene", "alt" eller "resten".
// Løse ingredienser vises da ikke. Ellers gjettes det:
// 1. Nevner steget en komponent, vises ingrediensene fra den som steget
//    også nevner ved navn. Nevner det ingen av dem, eller sier steget
//    "ingrediensene", "alt" eller "resten", vises alle i komponenten.
// 2. Ingrediensnavn i teksten vises fra de løse ingrediensene. Har en
//    nevnt komponent en ingrediens med samme navn, vinner komponentens.
// 3. Finnes en nevnt ingrediens bare inne i en komponent som ikke er nevnt,
//    vises den likevel (under komponentnavnet).
// Rekkefølge: løse først, så komponentene i oppskriftens rekkefølge.
export function ingredientsForStep(rawStepText: string, ingredients: RecipeIngredients): StepIngredientGroup[] {
  const stepText = stripTimerMarker(rawStepText)
  const segments = parseStep(stepText, ingredients)
  const linked = new Set(segments.flatMap((s) => (s.component ? [s.component] : [])))
  if (linked.size > 0) {
    // Komponentnavnet selv skal ikke telle som at en ingrediens er nevnt.
    const plain = segments.filter((s) => !s.component).map((s) => s.text).join(' ').toLowerCase()
    const whole = meansWholeComponent(plain)
    return ingredients.components
      .filter((c) => linked.has(c))
      .map((c) => {
        const named = c.ingredients.filter((i) => isMentioned(plain, i.name))
        return { componentName: c.name, items: named.length > 0 && !whole ? named : c.ingredients }
      })
      .filter((g) => g.items.length > 0)
  }

  const text = stepText.toLowerCase()
  const positions = new Map<IngredientItem, Positions>()
  const at = (item: IngredientItem) => {
    if (!positions.has(item)) positions.set(item, ingredientPositions(text, item.name))
    return positions.get(item)!
  }

  // Samme ord i teksten kan treffe flere ingredienser ("mel" treffer både
  // "hvetemel" og "Mel" i en komponent). Ordet går da til den første i
  // prioritert rekkefølge: nevnt komponent, løse ingredienser, øvrige komponenter.
  // Innenfor hver gruppe vinner treff på hele navnet ("sukker") over løsere
  // treff ("vaniljesukker" via "sukker").
  const claimed = new Set<number>()
  const claim = (items: IngredientItem[]) => {
    const picked = new Set<IngredientItem>()
    for (const kind of ['exact', 'loose'] as const) {
      const hits = items.filter((i) => !picked.has(i) && at(i)[kind].some((p) => !claimed.has(p)))
      for (const item of hits) {
        picked.add(item)
        for (const p of at(item)[kind]) claimed.add(p)
      }
    }
    return items.filter((i) => picked.has(i))
  }

  // Ordet som nevner en komponent ("sausen") skal ikke også telle som en
  // ingrediens ("soyasaus").
  for (const component of ingredients.components) {
    const name = norm(component.name)
    if (!name) continue
    for (let i = text.indexOf(name); i !== -1; i = text.indexOf(name, i + 1)) {
      if (i === 0 || !isWordChar(text[i - 1])) claimed.add(i)
    }
  }

  const whole = meansWholeComponent(text)
  const mentioned = new Map<RecipeComponent, IngredientItem[]>()
  for (const component of ingredients.components) {
    if (!mentionsAtWordStart(text, component.name)) continue
    const named = claim(component.ingredients)
    mentioned.set(component, named.length > 0 && !whole ? named : component.ingredients)
  }

  const groups: StepIngredientGroup[] = []
  const looseItems = claim(ingredients.loose)
  if (looseItems.length > 0) groups.push({ componentName: null, items: looseItems })

  for (const component of ingredients.components) {
    const items = mentioned.get(component) ?? claim(component.ingredients)
    if (items.length > 0) groups.push({ componentName: component.name, items })
  }

  return groups
}

export function formatScaledAmount(item: IngredientItem, factor: number): string {
  if (item.amount == null) return ''
  const value = Math.round(item.amount * factor * 10) / 10
  return `${value.toLocaleString('nb-NO')} ${item.unit}`.trim()
}
