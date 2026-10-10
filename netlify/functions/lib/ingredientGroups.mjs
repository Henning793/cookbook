// Finner overskriftene i ingredienslisten ("Marinade", "Dressing") på en
// oppskriftsside. schema.org-dataene har ingrediensene som én flat liste, så
// grupperingen må leses ut av selve HTML-en: ingredienslinjene letes opp i
// sideteksten, og en overskrift som står mellom to av dem starter en ny gruppe.
// Rene regler, ingen AI. Er noe uklart, returneres ingen grupper.

const INLINE_TAGS = new Set([
  'a', 'span', 'em', 'i', 'u', 'small', 'sup', 'sub', 'abbr', 'mark', 'strong', 'b',
  'label', 'font', 'time', 'data', 'bdi', 'wbr', 'img', 'input',
])
const BOLD_TAGS = new Set(['strong', 'b'])
const HEADING_TAGS = new Set(['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'legend', 'caption', 'dt', 'th', 'summary'])
const HEADING_CLASS = /(^|[\s_-])(group|heading|title|subtitle|header|overskrift|tittel)/i
// Overskrifter som bare sier at dette er ingredienslisten.
const GENERIC_HEADINGS = new Set(['ingredienser', 'ingredients', 'ingrediensliste', 'dutrenger', 'dettetrengerdu', 'handleliste'])

const MAX_HEADING_LENGTH = 60
// En ingredienslinje kan være delt på flere elementer (mengde, enhet, navn).
const MAX_BLOCKS_PER_LINE = 5
// Hvor langt etter forrige ingrediens den neste letes etter.
const MAX_GAP = 40
const MIN_PREFIX_KEY = 4
const MAX_LINE_LENGTH = 120
const MAX_START_CANDIDATES = 20
const FIRST_HEADING_LOOKBACK = 4
const MIN_MATCHED_SHARE = 0.8

const NAMED_ENTITIES = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
  aring: 'å', Aring: 'Å', oslash: 'ø', Oslash: 'Ø', aelig: 'æ', AElig: 'Æ',
  eacute: 'é', egrave: 'è', ouml: 'ö', auml: 'ä', uuml: 'ü',
  frac12: '½', frac14: '¼', frac34: '¾', ndash: '–', mdash: '—', deg: '°',
}

export function decodeEntities(text) {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z0-9]+);/gi, (whole, code) => {
    if (code[0] !== '#') return NAMED_ENTITIES[code] ?? whole
    const point = code[1] === 'x' || code[1] === 'X' ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10)
    return Number.isFinite(point) && point > 0 && point <= 0x10ffff ? String.fromCodePoint(point) : whole
  })
}

// Bare bokstavene, så "2 ss olje", "2ss olje" og "½ ss olje" sammenlignes likt.
function letterKey(text) {
  return text.toLowerCase().replace(/[^\p{L}]/gu, '')
}

function isHeading(block) {
  const text = block.text
  // Tall hører til porsjoner og mengder ("Gir ca. 24 porsjoner"), ikke gruppenavn.
  if (text.length > MAX_HEADING_LENGTH || /\d/.test(text) || !block.key) return false
  return (
    HEADING_TAGS.has(block.tag) ||
    block.bold ||
    HEADING_CLASS.test(block.className) ||
    text.endsWith(':')
  )
}

// Sideteksten som en flat rekke tekstblokker, i rekkefølgen de står på siden.
export function htmlToBlocks(html) {
  const cleaned = html
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<(script|style|noscript|template|svg|select|button)\b[\s\S]*?<\/\1\s*>/gi, ' ')

  const blocks = []
  let current = { text: '', bold: true, tag: '', className: '' }
  let boldDepth = 0

  function flush(tag, className) {
    const text = current.text.replace(/\s+/g, ' ').trim()
    if (text) {
      const block = { text, bold: current.bold, tag: current.tag, className: current.className, key: letterKey(text) }
      block.heading = isHeading(block)
      blocks.push(block)
    }
    current = { text: '', bold: true, tag, className }
  }

  function addText(raw) {
    const text = decodeEntities(raw)
    if (!text.trim()) {
      current.text += ' '
      return
    }
    current.text += text
    if (boldDepth === 0) current.bold = false
  }

  const tagPattern = /<(\/?)([a-zA-Z][a-zA-Z0-9]*)\b([^>]*)>/g
  let last = 0
  let match
  while ((match = tagPattern.exec(cleaned)) !== null) {
    if (match.index > last) addText(cleaned.slice(last, match.index))
    last = tagPattern.lastIndex

    const closing = match[1] === '/'
    const tag = match[2].toLowerCase()
    if (BOLD_TAGS.has(tag)) boldDepth = Math.max(0, boldDepth + (closing ? -1 : 1))
    if (INLINE_TAGS.has(tag)) {
      current.text += ' '
      continue
    }
    const className = closing ? '' : (/\bclass\s*=\s*["']([^"']*)["']/i.exec(match[3])?.[1] ?? '')
    flush(closing ? '' : tag, className)
  }
  if (last < cleaned.length) addText(cleaned.slice(last))
  flush('', '')

  return blocks
}

// Leter etter linjen fra og med blokk `from`. Returnerer første og siste blokk.
function findLine(blocks, key, from, to) {
  for (let start = from; start < Math.min(to, blocks.length); start++) {
    if (!blocks[start].key) continue
    let joined = ''
    let length = 0
    for (let end = start; end < Math.min(start + MAX_BLOCKS_PER_LINE, blocks.length); end++) {
      joined += blocks[end].key
      length += blocks[end].text.length
      if (joined === key) return { start, end }
      // Siden har ofte mer tekst på linjen enn dataene: "3 ss sukker, gjerne
      // brunt", eller mengden foran når dataene bare har navnet.
      if (joined.startsWith(key) || joined.endsWith(key)) {
        if (key.length >= MIN_PREFIX_KEY && length <= MAX_LINE_LENGTH) return { start, end }
        break
      }
      if (!key.startsWith(joined)) break
    }
  }
  return null
}

function align(blocks, keys, firstIndex, firstStart) {
  const matches = keys.map(() => null)
  let next = firstStart
  let count = 0
  for (let i = firstIndex; i < keys.length; i++) {
    if (!keys[i]) continue
    const limit = i === firstIndex ? next + 1 : next + MAX_GAP
    const found = findLine(blocks, keys[i], next, limit)
    if (!found) continue
    matches[i] = found
    next = found.end + 1
    count++
  }
  return { matches, count, span: next - firstStart }
}

function bestAlignment(blocks, keys) {
  // Første ingrediens som faktisk finnes på siden brukes som ankerpunkt, og
  // hver forekomst av den prøves: riktig sted er der flest linjer følger etter.
  for (let firstIndex = 0; firstIndex < keys.length; firstIndex++) {
    if (!keys[firstIndex]) continue
    let best = null
    let from = 0
    for (let tries = 0; tries < MAX_START_CANDIDATES; tries++) {
      const found = findLine(blocks, keys[firstIndex], from, blocks.length)
      if (!found) break
      const candidate = align(blocks, keys, firstIndex, found.start)
      if (!best || candidate.count > best.count || (candidate.count === best.count && candidate.span < best.span)) {
        best = candidate
      }
      from = found.start + 1
    }
    if (best) return best
  }
  return null
}

function blocksOf(match) {
  return Array.from({ length: match.end - match.start + 1 }, (_, n) => match.start + n)
}

function headingName(block) {
  return block.text.replace(/^@+/, '').replace(/:$/, '').trim()
}

function lastHeading(blocks, from, to) {
  for (let i = to - 1; i >= from; i--) {
    const block = blocks[i]
    if (block.heading && !GENERIC_HEADINGS.has(block.key) && headingName(block)) return block
  }
  return null
}

// Gruppenavnet for hver ingredienslinje (null = ingen gruppe). `lines` er
// ingredienslinjene slik de står i schema.org-dataene.
export function findIngredientGroups(html, lines) {
  const none = lines.map(() => null)
  if (typeof html !== 'string' || lines.length < 2) return none

  const blocks = htmlToBlocks(html)
  const keys = lines.map((line) => letterKey(decodeEntities(String(line).replace(/<[^>]*>/g, ' '))))
  const wanted = keys.filter(Boolean).length
  const alignment = bestAlignment(blocks, keys)
  if (!alignment || alignment.count < 2) return none

  const { matches } = alignment

  // Siden kan ha en annen rekkefølge enn dataene (matprat.no har de løse
  // ingrediensene øverst, dataene har dem sist). Linjer som ikke ble funnet i
  // rekkefølge letes derfor opp hvor som helst i og rundt ingredienslisten.
  const inOrder = matches.filter(Boolean)
  const windowStart = Math.max(0, inOrder[0].start - MAX_GAP)
  const windowEnd = inOrder[inOrder.length - 1].end + 1 + MAX_GAP
  const used = new Set(inOrder.flatMap((m) => blocksOf(m)))
  matches.forEach((match, i) => {
    if (match || !keys[i]) return
    for (let from = windowStart; from < windowEnd; ) {
      const found = findLine(blocks, keys[i], from, windowEnd)
      if (!found) return
      if (blocksOf(found).every((b) => !used.has(b))) {
        matches[i] = found
        for (const b of blocksOf(found)) used.add(b)
        return
      }
      from = found.start + 1
    }
  })

  if (matches.filter(Boolean).length < wanted * MIN_MATCHED_SHARE) return none

  // Gruppene følger rekkefølgen på siden: en overskrift gjelder linjene
  // under den, fram til neste overskrift.
  const onPage = matches
    .map((match, index) => ({ match, index }))
    .filter((entry) => entry.match)
    .sort((a, b) => a.match.start - b.match.start)

  const groups = lines.map(() => null)
  const laterHeadings = []
  let current = null
  for (let n = 1; n < onPage.length; n++) {
    const heading = lastHeading(blocks, onPage[n - 1].match.end + 1, onPage[n].match.start)
    if (heading) {
      current = headingName(heading)
      laterHeadings.push(heading)
    }
    groups[onPage[n].index] = current
  }

  // Én overskrift over hele listen er ikke en gruppe.
  if (laterHeadings.length === 0) return none

  // Overskriften over første ingrediens teller bare hvis den ser ut som de
  // andre gruppeoverskriftene (ellers er det sidetittel, "4 porsjoner" o.l.).
  const firstStart = onPage[0].match.start
  const first = lastHeading(blocks, Math.max(0, firstStart - FIRST_HEADING_LOOKBACK), firstStart)
  if (first && laterHeadings.some((h) => h.tag === first.tag && h.bold === first.bold && h.className === first.className)) {
    const name = headingName(first)
    for (const entry of onPage) {
      if (groups[entry.index] !== null) break
      groups[entry.index] = name
    }
  }

  // En linje som ikke finnes på siden følger nabolinjene i dataene når de
  // er enige, ellers blir den løs.
  matches.forEach((match, i) => {
    if (match) return
    let before = i - 1
    while (before >= 0 && !matches[before]) before--
    let after = i + 1
    while (after < lines.length && !matches[after]) after++
    const a = before >= 0 ? groups[before] : undefined
    const b = after < lines.length ? groups[after] : undefined
    groups[i] = a === undefined ? (b ?? null) : b === undefined || a === b ? a : null
  })

  return groups
}
