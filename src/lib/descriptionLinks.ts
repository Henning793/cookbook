// Lenker til andre oppskrifter i beskrivelsen: «Passer til @Rødvinssaus».
// Samme @-tegn som i stegene, men i beskrivelsen betyr det en oppskrift, ikke
// en komponent. Navnet slås opp blant oppskriftene brukeren ser, og lengste
// tittel vinner, så "@Ovnsbakte poteter" ikke tolkes som "@Ovnsbakte". Ukjente
// @-ord blir stående som tekst.

export type DescriptionPart = { text: string; recipeId?: string }

type RecipeRef = { id: string; title: string }

function norm(value: string) {
  return value.trim().toLocaleLowerCase('nb-NO')
}

function isWordChar(char: string | undefined): boolean {
  return char !== undefined && /[\p{L}\p{N}]/u.test(char)
}

function recipeAt(text: string, index: number, recipes: RecipeRef[]): { recipe: RecipeRef; length: number } | null {
  const rest = text.slice(index).toLocaleLowerCase('nb-NO')
  let best: { recipe: RecipeRef; length: number } | null = null
  for (const recipe of recipes) {
    const title = norm(recipe.title)
    if (!title || !rest.startsWith(title) || isWordChar(rest[title.length])) continue
    if (!best || title.length > best.length) best = { recipe, length: title.length }
  }
  return best
}

export function descriptionParts(text: string, recipes: RecipeRef[], selfId?: string): DescriptionPart[] {
  const candidates = recipes.filter((recipe) => recipe.id !== selfId)
  const parts: DescriptionPart[] = []
  let last = 0
  let at = text.indexOf('@')
  while (at !== -1) {
    const match = isWordChar(text[at - 1]) ? null : recipeAt(text, at + 1, candidates)
    if (match) {
      if (at > last) parts.push({ text: text.slice(last, at) })
      const end = at + 1 + match.length
      parts.push({ text: text.slice(at + 1, end), recipeId: match.recipe.id })
      last = end
    }
    at = text.indexOf('@', match ? last : at + 1)
  }
  if (last < text.length) parts.push({ text: text.slice(last) })
  return parts
}

// Forslag til autocomplete i beskrivelsen: titler som begynner med det som er
// skrevet etter "@", deretter titler der et senere ord gjør det.
export function recipeSuggestions(query: string, recipes: RecipeRef[], exclude?: string, limit = 6): string[] {
  const q = norm(query)
  const excluded = exclude ? norm(exclude) : null
  const seen = new Set<string>()
  const first: string[] = []
  const later: string[] = []
  for (const recipe of recipes) {
    const title = recipe.title.trim()
    const key = norm(title)
    if (!key || key === excluded || seen.has(key)) continue
    seen.add(key)
    if (key.startsWith(q)) first.push(title)
    else if (q && key.split(/\s+/).some((word) => word.startsWith(q))) later.push(title)
  }
  const byTitle = (a: string, b: string) => a.localeCompare(b, 'nb-NO')
  return [...first.sort(byTitle), ...later.sort(byTitle)].slice(0, limit)
}
