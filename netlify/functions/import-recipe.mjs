import { isUrlAllowed } from './lib/urlSafety.mjs'
import { extractRecipeJsonLd, normalizeRecipe } from './lib/parseRecipe.mjs'

const FETCH_TIMEOUT_MS = 8000
const MAX_RESPONSE_BYTES = 2 * 1024 * 1024

function jsonResponse(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

async function fetchHtml(url) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { 'user-agent': 'Mine oppskrifter-importer/1.0' },
    })

    if (!response.ok) {
      throw new Error(`Nettsiden svarte med status ${response.status}`)
    }

    const reader = response.body?.getReader()
    if (!reader) {
      return await response.text()
    }

    const decoder = new TextDecoder()
    let html = ''
    let bytesRead = 0

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      bytesRead += value.byteLength
      if (bytesRead > MAX_RESPONSE_BYTES) {
        await reader.cancel()
        throw new Error('Siden var for stor til å hentes')
      }

      html += decoder.decode(value, { stream: true })
    }

    return html
  } finally {
    clearTimeout(timeout)
  }
}

export default async (req) => {
  const url = new URL(req.url).searchParams.get('url')

  if (!url) {
    return jsonResponse(400, { error: 'Mangler url-parameter' })
  }

  if (!isUrlAllowed(url)) {
    return jsonResponse(400, { error: 'Denne URL-en kan ikke importeres fra' })
  }

  let html
  try {
    html = await fetchHtml(url)
  } catch {
    return jsonResponse(502, {
      error: 'Klarte ikke å hente siden. Sjekk at URL-en er riktig og prøv igjen.',
    })
  }

  const recipeNode = extractRecipeJsonLd(html)
  if (!recipeNode) {
    return jsonResponse(404, {
      error: 'Fant ingen strukturert oppskrift på denne siden. Prøv en annen kilde, eller legg den inn manuelt.',
    })
  }

  return jsonResponse(200, normalizeRecipe(recipeNode))
}
