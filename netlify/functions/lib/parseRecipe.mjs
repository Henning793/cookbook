import { decodeEntities, findIngredientGroups } from './ingredientGroups.mjs'

const UNIT_ALTERNATION = 'g|kg|ml|dl|l|ss|ts|stk|boks|klype'
const AMOUNT_PATTERN = /^\s*([\d.,/]+)/
const UNIT_PATTERN = new RegExp(`^\\s*(${UNIT_ALTERNATION})(?![a-zæøåA-ZÆØÅ])\\.?`, 'i')

function parseAmount(raw) {
  if (!raw) return null
  const normalized = raw.replace(',', '.')
  if (normalized.includes('/')) {
    const [numerator, denominator] = normalized.split('/').map(Number)
    if (Number.isFinite(numerator) && Number.isFinite(denominator) && denominator !== 0) {
      return numerator / denominator
    }
    return null
  }
  const value = Number(normalized)
  return Number.isFinite(value) ? value : null
}

export function parseIngredientLine(line) {
  let rest = line.trim()
  let rawAmount = null

  const amountMatch = rest.match(AMOUNT_PATTERN)
  if (amountMatch) {
    rawAmount = amountMatch[1]
    rest = rest.slice(amountMatch[0].length)
  }

  let unit = ''
  const unitMatch = rest.match(UNIT_PATTERN)
  if (unitMatch) {
    unit = unitMatch[1].toLowerCase()
    rest = rest.slice(unitMatch[0].length)
  }

  return {
    amount: parseAmount(rawAmount),
    unit,
    name: rest.trim(),
  }
}

export function normalizeSteps(recipeInstructions) {
  if (!recipeInstructions) return []

  if (typeof recipeInstructions === 'string') {
    return recipeInstructions
      .split(/\r?\n+/)
      .map((line) => line.trim())
      .filter(Boolean)
  }

  if (Array.isArray(recipeInstructions)) {
    const steps = []
    for (const item of recipeInstructions) {
      collectStepText(item, steps)
    }
    return steps
  }

  return []
}

function collectStepText(item, steps) {
  if (!item) return

  if (typeof item === 'string') {
    const trimmed = item.trim()
    if (trimmed) steps.push(trimmed)
    return
  }

  if (typeof item !== 'object') return

  if (item['@type'] === 'HowToSection' && Array.isArray(item.itemListElement)) {
    for (const child of item.itemListElement) {
      collectStepText(child, steps)
    }
    return
  }

  if (typeof item.text === 'string' && item.text.trim()) {
    steps.push(item.text.trim())
  }
}

function isRecipeType(node) {
  if (!node || typeof node !== 'object') return false
  const type = node['@type']
  if (!type) return false
  return Array.isArray(type) ? type.includes('Recipe') : type === 'Recipe'
}

function findRecipeNode(node) {
  if (!node || typeof node !== 'object') return null
  if (isRecipeType(node)) return node
  if (Array.isArray(node['@graph'])) {
    for (const item of node['@graph']) {
      if (isRecipeType(item)) return item
    }
  }
  return null
}

export function extractRecipeJsonLd(html) {
  const scriptPattern = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi
  let match

  while ((match = scriptPattern.exec(html)) !== null) {
    let parsed
    try {
      parsed = JSON.parse(match[1].trim())
    } catch {
      continue
    }

    const candidates = Array.isArray(parsed) ? parsed : [parsed]
    for (const candidate of candidates) {
      const found = findRecipeNode(candidate)
      if (found) return found
    }
  }

  return null
}

// "4", 4, "4 porsjoner" og ["4", "4 porsjoner"] blir 4.
export function parseServings(recipeYield) {
  const value = Array.isArray(recipeYield) ? recipeYield[0] : recipeYield
  const match = /\d+/.exec(typeof value === 'number' ? String(value) : typeof value === 'string' ? value : '')
  const servings = match ? Number(match[0]) : 0
  return servings > 0 && servings <= 1000 ? servings : null
}

// `html` er siden oppskriften ble hentet fra. Den brukes til å finne
// overskriftene i ingredienslisten, som ikke finnes i schema.org-dataene.
// `ingredients` er alltid hele listen flatt; `loose` og `components` er den
// samme listen delt slik oppskriftsskjemaet vil ha den.
export function normalizeRecipe(jsonLdRecipe, html = '') {
  const title = typeof jsonLdRecipe.name === 'string' ? decodeEntities(jsonLdRecipe.name).trim() : ''
  const rawIngredients = Array.isArray(jsonLdRecipe.recipeIngredient) ? jsonLdRecipe.recipeIngredient : []
  const lines = rawIngredients.filter((line) => typeof line === 'string' && line.trim())

  const ingredients = lines.map((line) => parseIngredientLine(decodeEntities(line)))
  const groups = findIngredientGroups(html, lines)

  const loose = []
  const components = []
  ingredients.forEach((ingredient, index) => {
    const name = groups[index]
    if (name === null) {
      loose.push(ingredient)
      return
    }
    let component = components.find((c) => c.name.toLowerCase() === name.toLowerCase())
    if (!component) {
      component = { name, ingredients: [] }
      components.push(component)
    }
    component.ingredients.push(ingredient)
  })

  // Noen sider (coop.no) legger gruppeoverskrifter inn som egne steg.
  const steps = normalizeSteps(jsonLdRecipe.recipeInstructions).filter((step) => !/^GROUP:/i.test(step))

  return { title, ingredients, loose, components, steps, servings: parseServings(jsonLdRecipe.recipeYield) }
}
