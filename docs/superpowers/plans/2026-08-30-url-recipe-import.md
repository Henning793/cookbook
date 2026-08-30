# URL-import av oppskrifter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** La en innlogget bruker lime inn en URL til en oppskrift, hente ut strukturerte data (schema.org "Recipe" JSON-LD) via en Netlify Function, og få dem forhåndsutfylt i det eksisterende oppskrift-skjemaet for gjennomsyn før lagring.

**Architecture:** En ny Netlify Function (`netlify/functions/import-recipe.mjs`) henter målsiden server-side (unngår CORS), parser `<script type="application/ld+json">`-blokker etter en `Recipe`-node, og normaliserer den til appens `{ title, ingredients, steps }`-format. Frontend legger til en "Importer fra URL"-inngang i `AddRecipeForm`, som kaller funksjonen og forhåndsutfyller den eksisterende delte `RecipeForm`-komponenten. Ingen database- eller RLS-endringer.

**Tech Stack:** Netlify Functions (v2, ren ESM/`.mjs`, ingen `@netlify/functions`-avhengighet), native `fetch`/`AbortController`/Web Streams (Node 18+ runtime), Node sin innebygde testrunner (`node --test`) for de rene parsing-/valideringsfunksjonene.

**Spec:** [docs/superpowers/specs/2026-08-30-url-recipe-import-design.md](../specs/2026-08-30-url-recipe-import-design.md)

## Global Constraints

- Ingen AI/OCR — kun nøkkelfri parsing av schema.org-data (fra spec).
- Ingen ny npm-avhengighet for selve Netlify-funksjonen — bruk kun Node sine innebygde APIer.
- Funksjonsmappe: `netlify/functions` (konfigureres i `netlify.toml`); handleren `import-recipe.mjs` blir automatisk tilgjengelig på `/.netlify/functions/import-recipe`.
- Alle brukervendte feilmeldinger skal være tydelige og på norsk.
- Importert data skal **aldri** lagres automatisk — den går alltid gjennom den eksisterende `RecipeForm`-gjennomgangen og vanlig "Lagre oppskrift"-innsending.
- SSRF-beskyttelse er påkrevd: avvis ikke-http(s)-skjema og kjente private/interne IP-/hostname-mønstre (`localhost`, `127.x`, `10.x`, `172.16-31.x`, `192.168.x`, `169.254.x`, `::1`), siden endepunktet er uautentisert og offentlig tilgjengelig.
- Ekstern henting: tidsavbrudd 8000 ms, maks 2 MB lest respons-body, `User-Agent: "Mine oppskrifter-importer/1.0"`.
- Prosjektet har ingen frontend-testrammeverk fra før (bekreftet i eksisterende kodebase) — dette endres ikke her. De rene backend-hjelpefunksjonene (parsing/validering) er derimot enkle å enhetsteste med Node sin innebygde testrunner uten nye avhengigheter, så de får testdekning.

---

## Task 1: SSRF-beskyttelse (`isUrlAllowed`)

**Files:**
- Create: `netlify/functions/lib/urlSafety.mjs`
- Test: `netlify/functions/lib/urlSafety.test.mjs`
- Modify: `package.json` (legg til `test`-script)

**Interfaces:**
- Produces: `isUrlAllowed(urlString: string): boolean` — brukes av Task 3 (`import-recipe.mjs`) for å avvise farlige URL-er før noe hentes.

- [ ] **Step 1: Legg til test-script i package.json**

Åpne `package.json` og legg til i `"scripts"`:

```json
"test": "node --test netlify/functions/lib"
```

- [ ] **Step 2: Skriv de feilende testene**

Opprett `netlify/functions/lib/urlSafety.test.mjs`:

```js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { isUrlAllowed } from './urlSafety.mjs'

test('tillater vanlige https-URL-er', () => {
  assert.equal(isUrlAllowed('https://www.example.com/oppskrift'), true)
})

test('tillater http-URL-er', () => {
  assert.equal(isUrlAllowed('http://example.com'), true)
})

test('avviser localhost', () => {
  assert.equal(isUrlAllowed('http://localhost:3000'), false)
})

test('avviser 127.0.0.1', () => {
  assert.equal(isUrlAllowed('http://127.0.0.1'), false)
})

test('avviser private 192.168.x.x', () => {
  assert.equal(isUrlAllowed('http://192.168.1.5'), false)
})

test('avviser private 10.x.x.x', () => {
  assert.equal(isUrlAllowed('http://10.0.0.1'), false)
})

test('avviser private 172.16-31.x.x', () => {
  assert.equal(isUrlAllowed('http://172.20.0.1'), false)
})

test('tillater 172.15.x.x (utenfor privat rekke)', () => {
  assert.equal(isUrlAllowed('http://172.15.0.1'), true)
})

test('avviser 169.254.x.x (cloud metadata)', () => {
  assert.equal(isUrlAllowed('http://169.254.169.254'), false)
})

test('avviser ikke-http(s)-skjema', () => {
  assert.equal(isUrlAllowed('file:///etc/passwd'), false)
})

test('avviser ugyldig URL', () => {
  assert.equal(isUrlAllowed('ikke en url'), false)
})
```

- [ ] **Step 3: Kjør testene og bekreft at de feiler**

Run: `npm test`
Expected: FAIL med feilmelding om at `./urlSafety.mjs` ikke finnes (modulen er ikke opprettet ennå).

- [ ] **Step 4: Implementer `isUrlAllowed`**

Opprett `netlify/functions/lib/urlSafety.mjs`:

```js
const PRIVATE_HOST_PATTERNS = [
  /^localhost$/i,
  /^127\./,
  /^0\.0\.0\.0$/,
  /^10\./,
  /^192\.168\./,
  /^169\.254\./,
  /^172\.(1[6-9]|2\d|3[0-1])\./,
  /^\[?::1\]?$/,
]

export function isUrlAllowed(urlString) {
  let parsed
  try {
    parsed = new URL(urlString)
  } catch {
    return false
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return false
  }

  return !PRIVATE_HOST_PATTERNS.some((pattern) => pattern.test(parsed.hostname))
}
```

- [ ] **Step 5: Kjør testene og bekreft at de passerer**

Run: `npm test`
Expected: PASS på alle 11 testene i `urlSafety.test.mjs`.

- [ ] **Step 6: Commit**

```bash
git add package.json netlify/functions/lib/urlSafety.mjs netlify/functions/lib/urlSafety.test.mjs
git commit -m "Legg til SSRF-beskyttelse for oppskrift-import"
```

---

## Task 2: Parsing av schema.org-oppskriftsdata

**Files:**
- Create: `netlify/functions/lib/parseRecipe.mjs`
- Test: `netlify/functions/lib/parseRecipe.test.mjs`

**Interfaces:**
- Consumes: ingenting fra Task 1.
- Produces:
  - `extractRecipeJsonLd(html: string): object | null` — finner og returnerer JSON-LD-noden for en `Recipe`, eller `null`.
  - `normalizeSteps(recipeInstructions: unknown): string[]`
  - `parseIngredientLine(line: string): { amount: number | null, unit: string, name: string }`
  - `normalizeRecipe(jsonLdRecipe: object): { title: string, ingredients: Array<{amount: number|null, unit: string, name: string}>, steps: string[] }`
  - Alle fire brukes av Task 3 (`import-recipe.mjs`).

- [ ] **Step 1: Skriv de feilende testene**

Opprett `netlify/functions/lib/parseRecipe.test.mjs`:

```js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  parseIngredientLine,
  normalizeSteps,
  extractRecipeJsonLd,
  normalizeRecipe,
} from './parseRecipe.mjs'

test('parseIngredientLine tolker mengde, enhet og navn', () => {
  assert.deepEqual(parseIngredientLine('300 g kylling'), { amount: 300, unit: 'g', name: 'kylling' })
})

test('parseIngredientLine tolker brøk', () => {
  assert.deepEqual(parseIngredientLine('1/2 ts salt'), { amount: 0.5, unit: 'ts', name: 'salt' })
})

test('parseIngredientLine tolker desimaltall med komma', () => {
  assert.deepEqual(parseIngredientLine('2,5 dl melk'), { amount: 2.5, unit: 'dl', name: 'melk' })
})

test('parseIngredientLine faller tilbake til ren tekst uten mengde/enhet', () => {
  assert.deepEqual(parseIngredientLine('salt etter smak'), { amount: null, unit: '', name: 'salt etter smak' })
})

test('parseIngredientLine tolker enhet uten mengde', () => {
  assert.deepEqual(parseIngredientLine('boks hermetiske tomater'), { amount: null, unit: 'boks', name: 'hermetiske tomater' })
})

test('normalizeSteps deler en enkelt tekststreng på linjeskift', () => {
  assert.deepEqual(normalizeSteps('Stek løken.\nTilsett krydder.'), ['Stek løken.', 'Tilsett krydder.'])
})

test('normalizeSteps bruker et array av strenger direkte', () => {
  assert.deepEqual(normalizeSteps(['Stek løken.', 'Tilsett krydder.']), ['Stek løken.', 'Tilsett krydder.'])
})

test('normalizeSteps trekker ut text fra HowToStep-objekter', () => {
  const instructions = [
    { '@type': 'HowToStep', text: 'Stek løken.' },
    { '@type': 'HowToStep', text: 'Tilsett krydder.' },
  ]
  assert.deepEqual(normalizeSteps(instructions), ['Stek løken.', 'Tilsett krydder.'])
})

test('normalizeSteps går inn i HowToSection', () => {
  const instructions = [
    {
      '@type': 'HowToSection',
      name: 'Saus',
      itemListElement: [{ '@type': 'HowToStep', text: 'Bland sausen.' }],
    },
  ]
  assert.deepEqual(normalizeSteps(instructions), ['Bland sausen.'])
})

test('normalizeSteps returnerer tom liste for manglende data', () => {
  assert.deepEqual(normalizeSteps(undefined), [])
})

test('extractRecipeJsonLd finner en direkte Recipe-node', () => {
  const html = `
    <html><head>
    <script type="application/ld+json">
    { "@context": "https://schema.org", "@type": "Recipe", "name": "Curry" }
    </script>
    </head></html>
  `
  const result = extractRecipeJsonLd(html)
  assert.equal(result.name, 'Curry')
})

test('extractRecipeJsonLd finner Recipe inni @graph', () => {
  const html = `
    <script type="application/ld+json">
    { "@graph": [ { "@type": "WebPage" }, { "@type": "Recipe", "name": "Pizza" } ] }
    </script>
  `
  const result = extractRecipeJsonLd(html)
  assert.equal(result.name, 'Pizza')
})

test('extractRecipeJsonLd returnerer null når ingen Recipe finnes', () => {
  const html = '<script type="application/ld+json">{ "@type": "WebPage" }</script>'
  assert.equal(extractRecipeJsonLd(html), null)
})

test('extractRecipeJsonLd hopper over ugyldig JSON og fortsetter', () => {
  const html = `
    <script type="application/ld+json">{ ikke gyldig json </script>
    <script type="application/ld+json">{ "@type": "Recipe", "name": "Suppe" }</script>
  `
  const result = extractRecipeJsonLd(html)
  assert.equal(result.name, 'Suppe')
})

test('normalizeRecipe setter sammen tittel, ingredienser og steg', () => {
  const node = {
    name: 'Curry',
    recipeIngredient: ['300 g kylling', 'salt etter smak'],
    recipeInstructions: ['Stek kyllingen.', 'Server.'],
  }
  assert.deepEqual(normalizeRecipe(node), {
    title: 'Curry',
    ingredients: [
      { amount: 300, unit: 'g', name: 'kylling' },
      { amount: null, unit: '', name: 'salt etter smak' },
    ],
    steps: ['Stek kyllingen.', 'Server.'],
  })
})
```

- [ ] **Step 2: Kjør testene og bekreft at de feiler**

Run: `npm test`
Expected: FAIL med feilmelding om at `./parseRecipe.mjs` ikke finnes.

- [ ] **Step 3: Implementer parseRecipe.mjs**

Opprett `netlify/functions/lib/parseRecipe.mjs`:

```js
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
```

- [ ] **Step 4: Kjør testene og bekreft at de passerer**

Run: `npm test`
Expected: PASS på alle testene i både `urlSafety.test.mjs` og `parseRecipe.test.mjs`.

- [ ] **Step 5: Commit**

```bash
git add netlify/functions/lib/parseRecipe.mjs netlify/functions/lib/parseRecipe.test.mjs
git commit -m "Legg til parsing av schema.org-oppskriftsdata (JSON-LD)"
```

---

## Task 3: Netlify Function-handler

**Files:**
- Create: `netlify/functions/import-recipe.mjs`
- Modify: `netlify.toml`

**Interfaces:**
- Consumes: `isUrlAllowed` (Task 1), `extractRecipeJsonLd` + `normalizeRecipe` (Task 2).
- Produces: HTTP-endepunkt `GET /.netlify/functions/import-recipe?url=<url>` som returnerer `200 { title, ingredients, steps }` eller en feil-status med `{ error: string }`. Brukes av Task 4 (`src/lib/importRecipe.ts`).

- [ ] **Step 1: Legg til functions-mappe i netlify.toml**

Åpne `netlify.toml` og legg til en `[functions]`-seksjon (rekkefølge i filen spiller ikke noen rolle):

```toml
[build]
  command = "npm run build"
  publish = "dist"

[functions]
  directory = "netlify/functions"

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
```

- [ ] **Step 2: Implementer handleren**

Opprett `netlify/functions/import-recipe.mjs`:

```js
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
```

- [ ] **Step 3: Manuell verifisering med Netlify CLI**

Vite sin egen dev-server (`npm run dev`) serverer ikke `/.netlify/functions/*` — det krever Netlify CLI. Har du den installert (`npx netlify --version`), kjør:

```bash
npx netlify dev
```

Åpne appen på adressen CLI-en oppgir, og test i nettleserens adressefelt eller med `curl` mot en ekte oppskrift-URL du vet bruker schema.org-data, f.eks.:

```bash
curl "http://localhost:8888/.netlify/functions/import-recipe?url=https://<en-ekte-oppskrift-url>"
```

Expected: JSON-respons med `title`, `ingredients` og `steps` fylt ut. Test også med en URL uten strukturerte data (forvent `404` med tydelig feilmelding) og en åpenbart intern URL som `http://localhost` (forvent `400`).

Har du ikke Netlify CLI installert, hopp over dette steget nå — hele importflyten verifiseres uansett manuelt i nettleseren etter Task 5, mot den deployede Netlify-forhåndsvisningen.

- [ ] **Step 4: Commit**

```bash
git add netlify.toml netlify/functions/import-recipe.mjs
git commit -m "Legg til Netlify Function for å importere oppskrift fra URL"
```

---

## Task 4: Frontend-klient for import

**Files:**
- Create: `src/lib/importRecipe.ts`

**Interfaces:**
- Consumes: HTTP-endepunktet fra Task 3.
- Produces: `importRecipeFromUrl(url: string): Promise<{ title: string; ingredients: IngredientItem[]; steps: string[] }>` — kaster en `Error` med en brukervendt norsk melding ved feil. Brukes av Task 5 (`AddRecipeForm.tsx`).

- [ ] **Step 1: Implementer klienten**

Opprett `src/lib/importRecipe.ts`:

```ts
import type { IngredientItem } from '../types'

export interface ImportedRecipe {
  title: string
  ingredients: IngredientItem[]
  steps: string[]
}

export async function importRecipeFromUrl(url: string): Promise<ImportedRecipe> {
  const response = await fetch(`/.netlify/functions/import-recipe?url=${encodeURIComponent(url)}`)
  const data = await response.json()

  if (!response.ok) {
    throw new Error(data.error ?? 'Klarte ikke å importere oppskriften')
  }

  return data
}
```

- [ ] **Step 2: Verifiser at prosjektet fortsatt bygger**

Run: `npm run build`
Expected: Bygget fullfører uten TypeScript-feil (denne modulen har ingen kjørende referanse ennå, men skal typesjekke rent).

- [ ] **Step 3: Commit**

```bash
git add src/lib/importRecipe.ts
git commit -m "Legg til frontend-klient for URL-import"
```

---

## Task 5: UI for import i AddRecipeForm

**Files:**
- Modify: `src/components/AddRecipeForm.tsx`
- Modify: `src/App.css`

**Interfaces:**
- Consumes: `importRecipeFromUrl` (Task 4), `RecipeForm`/`RecipeFormValues` (eksisterende, fra `rediger-oppskrift`-arbeidet).
- Produces: ingenting nytt for andre tasks — dette er det siste synlige leddet i kjeden.

- [ ] **Step 1: Oppdater AddRecipeForm.tsx**

Erstatt hele innholdet i `src/components/AddRecipeForm.tsx`:

```tsx
import { useState, type FormEvent } from 'react'
import { supabase } from '../lib/supabaseClient'
import { importRecipeFromUrl } from '../lib/importRecipe'
import { RecipeForm, type RecipeFormValues } from './RecipeForm'

interface Props {
  onAdded: () => void
}

type View = 'closed' | 'import' | 'form'

export function AddRecipeForm({ onAdded }: Props) {
  const [view, setView] = useState<View>('closed')
  const [importUrl, setImportUrl] = useState('')
  const [importing, setImporting] = useState(false)
  const [importError, setImportError] = useState('')
  const [importedValues, setImportedValues] = useState<RecipeFormValues | null>(null)

  function reset() {
    setView('closed')
    setImportUrl('')
    setImportError('')
    setImportedValues(null)
  }

  async function handleSubmit(values: RecipeFormValues) {
    const { error } = await supabase.from('recipes').insert(values)
    if (error) throw error
    reset()
    onAdded()
  }

  async function handleImport(e: FormEvent) {
    e.preventDefault()
    setImporting(true)
    setImportError('')

    try {
      const imported = await importRecipeFromUrl(importUrl)
      setImportedValues({ ...imported, image_url: null })
      setView('form')
    } catch (err) {
      setImportError(err instanceof Error ? err.message : 'Noe gikk galt')
    } finally {
      setImporting(false)
    }
  }

  if (view === 'closed') {
    return (
      <div className="add-recipe-entry">
        <button className="add-recipe-toggle" onClick={() => setView('form')}>
          + Legg til oppskrift
        </button>
        <button className="link-button" onClick={() => setView('import')}>
          Importer fra URL
        </button>
      </div>
    )
  }

  if (view === 'import') {
    return (
      <form className="add-recipe-form" onSubmit={handleImport}>
        <h2>Importer oppskrift fra URL</h2>

        <label htmlFor="import-url">Lenke til oppskrift</label>
        <input
          id="import-url"
          type="url"
          required
          placeholder="https://..."
          value={importUrl}
          onChange={(e) => setImportUrl(e.target.value)}
        />

        {importError && <p className="error">{importError}</p>}

        <div className="form-actions">
          <button type="button" onClick={reset} disabled={importing}>
            Avbryt
          </button>
          <button type="submit" disabled={importing}>
            {importing ? 'Henter...' : 'Hent oppskrift'}
          </button>
        </div>
      </form>
    )
  }

  return (
    <RecipeForm
      heading={importedValues ? 'Se gjennom importert oppskrift' : 'Ny oppskrift i din kokebok'}
      initial={importedValues ?? undefined}
      submitLabel="Lagre oppskrift"
      savingLabel="Lagrer..."
      onSubmit={handleSubmit}
      onCancel={reset}
    />
  )
}
```

- [ ] **Step 2: Legg til CSS for de to inngangs-knappene**

I `src/App.css`, finn regelen `.add-recipe-toggle { ... }` og legg til rett etter den:

```css
.add-recipe-entry {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-bottom: 24px;
}

.add-recipe-entry .add-recipe-toggle {
  margin-bottom: 0;
}

.add-recipe-entry .link-button {
  align-self: center;
}

.menu-dropdown .add-recipe-entry {
  margin-bottom: 0;
}
```

- [ ] **Step 3: Bygg og lint**

Run: `npm run build && npm run lint`
Expected: Begge fullfører uten nye feil (det kjente `set-state-in-effect`-varselet i `App.tsx` er forventet og urelatert).

- [ ] **Step 4: Manuell verifisering i nettleser**

Logg inn, åpne hamburgermenyen, og bekreft:
- "+ Legg til oppskrift" og "Importer fra URL" vises begge når menyen er lukket for skjema-visning.
- "Importer fra URL" åpner URL-feltet; "Avbryt" går tilbake.
- En gyldig oppskrift-URL med schema.org-data fyller ut `RecipeForm` med tittel/ingredienser/steg du kan redigere før du trykker "Lagre oppskrift".
- En URL uten strukturerte data gir feilmeldingen fra funksjonen, uten krasj.
- Den lagrede oppskriften dukker opp i listen som normalt, med riktig eier.

(Krever `npx netlify dev` eller en deployet Netlify-forhåndsvisning, siden `npm run dev` alene ikke serverer funksjonen — se Task 3, Step 3.)

- [ ] **Step 5: Commit**

```bash
git add src/components/AddRecipeForm.tsx src/App.css
git commit -m "Legg til UI for å importere oppskrift fra URL"
```

---

## Task 6: Dokumentasjon

**Files:**
- Modify: `README.md`

**Interfaces:**
- Consumes: ingenting.
- Produces: ingenting (dokumentasjon).

- [ ] **Step 1: Legg til en seksjon om import i README.md**

Legg til en ny seksjon etter "Logg inn for å legge til oppskrifter" (eller der det passer best i den eksisterende nummereringen):

```markdown
## Importer oppskrift fra URL

Inne i menyen finner du "Importer fra URL" ved siden av "+ Legg til
oppskrift". Lim inn en lenke til en oppskrift, og appen forsøker å hente ut
tittel, ingredienser og fremgangsmåte automatisk.

Dette fungerer kun på nettsider som har strukturerte oppskriftsdata
innebygd (schema.org "Recipe" — det formatet Google bruker for
oppskrift-forhåndsvisninger i søk). De fleste store oppskriftsider har
dette, men ikke alle. Fungerer det ikke, gir appen en tydelig feilmelding,
og du kan legge inn oppskriften manuelt i stedet.

Importen fyller kun ut skjemaet — ingenting lagres før du selv trykker
"Lagre oppskrift". Ingrediens-mengder og -enheter tolkes automatisk der det
går, men sjekk gjerne gjennom før lagring siden tolkningen er
"best effort" og ikke alltid perfekt.

Ingen API-nøkkel eller ekstra kostnad er nødvendig for denne funksjonen.
```

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "Dokumenter URL-import av oppskrifter i README"
```

---

## Self-Review Notes

- **Spec-dekning:** SSRF-beskyttelse (Task 1), JSON-LD/ingrediens/steg-parsing (Task 2), selve henting+endepunkt (Task 3), frontend-klient (Task 4), UI-integrasjon med forhåndsutfylt `RecipeForm` og "aldri lagre automatisk" (Task 5), README (Task 6) — alle spec-seksjoner er dekket.
- **Typekonsistens:** `RecipeFormValues` (fra eksisterende `RecipeForm.tsx`) har formen `{ title, ingredients, steps, image_url }`, som matcher `ImportedRecipe & { image_url: null }` brukt i Task 5 — bekreftet konsistent.
- **Ingen placeholders:** alle steg inneholder ferdig kode eller eksakte kommandoer.
- **Regex-fiks:** første utkast av `INGREDIENT_LINE_PATTERN` gjenbrukte en fangende gruppe for enhet inni et ikke-fangende ledd, som ville gitt tre fangst-grupper og forskjøvet `name` til å bli enhetsteksten. Rettet til en ren `(?:...)`-alternasjon uten indre fangst, slik at `match` alltid gir nøyaktig `[full, rawAmount, name]` som destruktureringen i Step 3 forventer.
