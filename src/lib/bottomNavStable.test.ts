import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

// Bunnmenyen skal aldri bevege seg på iPhone. Den ligger med position: fixed,
// og det holder bare så lenge siden verken blir bredere enn skjermen eller er
// zoomet inn. Disse testene vokter CSS-en som sørger for det.

const indexCss = readFileSync(new URL('../index.css', import.meta.url), 'utf8')
const appCss = readFileSync(new URL('../App.css', import.meta.url), 'utf8')

function withoutComments(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, '')
}

// Innholdet i blokken som starter ved `start` (posisjonen til en `{`).
function blockAt(css: string, start: number): string {
  let depth = 0
  for (let i = start; i < css.length; i++) {
    if (css[i] === '{') depth++
    else if (css[i] === '}' && --depth === 0) return css.slice(start + 1, i)
  }
  throw new Error('Blokken slutter ikke')
}

// Deklarasjonene i regelen med nøyaktig denne selektoren (første treff).
function rule(css: string, selector: string): Record<string, string> {
  const clean = withoutComments(css)
  const pattern = new RegExp(`(^|[}\\n])\\s*${selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+')}\\s*\\{`)
  const match = pattern.exec(clean)
  assert.ok(match, `fant ikke regelen ${selector}`)
  const body = blockAt(clean, match.index + match[0].length - 1)
  const declarations: Record<string, string> = {}
  for (const part of body.split(';')) {
    const colon = part.indexOf(':')
    if (colon === -1) continue
    declarations[part.slice(0, colon).trim()] = part.slice(colon + 1).trim()
  }
  return declarations
}

function iosBlock(): string {
  const clean = withoutComments(indexCss)
  const at = clean.indexOf('@supports (-webkit-touch-callout: none)')
  assert.notEqual(at, -1, 'index.css mangler @supports-blokken for iPhone')
  return blockAt(clean, clean.indexOf('{', at))
}

test('bunnmenyen ligger fast nederst på skjermen', () => {
  const nav = rule(appCss, '.bottom-nav')
  assert.equal(nav.position, 'fixed')
  assert.equal(nav.bottom, '0')
  assert.equal(nav.left, '0')
  assert.equal(nav.right, '0')
  assert.equal(nav.transform, undefined, 'bunnmenyen skal ikke flyttes med transform')
  assert.equal(nav.transition, undefined, 'bunnmenyen skal ikke gli inn eller ut')
})

test('siden kan ikke bli bredere enn skjermen', () => {
  assert.equal(rule(indexCss, 'html')['overflow-x'], 'clip')
  assert.equal(rule(indexCss, 'body')['overflow-x'], 'clip')
})

test('iPhone zoomer ikke inn når man skriver i et tekstfelt', () => {
  // iPhone zoomer inn på felt med skrift under 16px, og da glir bunnmenyen
  // bort når man blar (handlelisten har felt på 15px).
  const fields = rule(iosBlock(), 'input,\n  textarea,\n  select')
  const size = fields['font-size']
  assert.match(size ?? '', /^(\d+)px !important$/)
  assert.ok(parseInt(size) >= 16, `tekstfelt på iPhone må ha minst 16px, har ${size}`)
})

test('felt med skrift over 16px beholder størrelsen på iPhone', () => {
  // Regelen over setter alle felt til 16px. Felt som er større fra før må
  // unntas, ellers krymper de.
  const clean = withoutComments(appCss)
  const block = iosBlock()
  const ruleRe = /([^{}]+)\{([^{}]*)\}/g
  for (const [, selectors, body] of clean.matchAll(ruleRe)) {
    const size = /font(?:-size)?:[^;]*?(\d+(?:\.\d+)?)px/.exec(body)?.[1]
    if (!size || Number(size) <= 16) continue
    for (const selector of selectors.split(',').map((s) => s.trim())) {
      if (!/(^|\s|>)(input|textarea|select)\b/.test(selector)) continue
      const kept = rule(block, selector)['font-size']
      assert.equal(kept, `${size}px !important`, `${selector} mister størrelsen ${size}px på iPhone`)
    }
  }
})

test('lange varenavn i handlelisten brytes i stedet for å gjøre siden bredere', () => {
  const name = rule(appCss, '.handleliste-name')
  assert.equal(name['min-width'], '0')
  assert.equal(name['overflow-wrap'], 'anywhere')
})
