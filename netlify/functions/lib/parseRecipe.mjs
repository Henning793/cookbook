const UNIT_ALTERNATION = 'g|kg|ml|dl|l|ss|ts|stk|boks|klype'
const INGREDIENT_LINE_PATTERN = new RegExp(
  `^\\s*([\\d.,/]+)?\\s*(?:${UNIT_ALTERNATION})?\\s*(.+?)\\s*$`,
  'i'
)
const UNIT_CAPTURE_PATTERN = new RegExp(`^\\s*[\\d.,/]*\\s*(${UNIT_ALTERNATION})\\b`, 'i')

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
  const trimmed = line.trim()
  const match = trimmed.match(INGREDIENT_LINE_PATTERN)
  if (!match) {
    return { amount: null, unit: '', name: trimmed }
  }

  const [, rawAmount, name] = match
  const unitMatch = trimmed.match(UNIT_CAPTURE_PATTERN)

  return {
    amount: parseAmount(rawAmount),
    unit: unitMatch ? unitMatch[1].toLowerCase() : '',
    name: (name || trimmed).trim(),
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

export function normalizeRecipe(jsonLdRecipe) {
  const title = typeof jsonLdRecipe.name === 'string' ? jsonLdRecipe.name.trim() : ''
  const rawIngredients = Array.isArray(jsonLdRecipe.recipeIngredient) ? jsonLdRecipe.recipeIngredient : []

  const ingredients = rawIngredients
    .filter((line) => typeof line === 'string' && line.trim())
    .map(parseIngredientLine)

  const steps = normalizeSteps(jsonLdRecipe.recipeInstructions)

  return { title, ingredients, steps }
}
