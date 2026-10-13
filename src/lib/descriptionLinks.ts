// Lenker til andre oppskrifter i beskrivelsen: «Passer til *Rødvinssaus*».
// Tittelen mellom stjernene slås opp blant oppskriftene brukeren ser. Uten
// treff vises bare ordet, uten stjerner og uten lenke.

export type DescriptionPart = { text: string; recipeId?: string }

const LINK_PATTERN = /\*([^*\n]+)\*/g

function normalizeTitle(title: string) {
  return title.trim().toLocaleLowerCase('nb-NO')
}

export function descriptionParts(
  text: string,
  recipes: { id: string; title: string }[],
  selfId?: string
): DescriptionPart[] {
  const byTitle = new Map<string, string>()
  for (const recipe of recipes) {
    const key = normalizeTitle(recipe.title)
    if (recipe.id !== selfId && !byTitle.has(key)) byTitle.set(key, recipe.id)
  }

  const parts: DescriptionPart[] = []
  let last = 0
  for (const match of text.matchAll(LINK_PATTERN)) {
    const start = match.index
    if (start > last) parts.push({ text: text.slice(last, start) })
    const title = match[1]
    const recipeId = byTitle.get(normalizeTitle(title))
    parts.push(recipeId ? { text: title, recipeId } : { text: title })
    last = start + match[0].length
  }
  if (last < text.length) parts.push({ text: text.slice(last) })

  // Slå sammen nabobiter uten lenke, så teksten blir hel der ingenting lenkes.
  return parts.reduce<DescriptionPart[]>((merged, part) => {
    const prev = merged[merged.length - 1]
    if (prev && !prev.recipeId && !part.recipeId) prev.text += part.text
    else merged.push({ ...part })
    return merged
  }, [])
}
