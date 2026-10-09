// Nedtelling per steg i kokemodus. Ren modul (ingen supabase-/Vite-import)
// slik at den kan enhetstestes med vanlig `node --test`.
//
// Tiden gjettes fra stegteksten ("La hvile i 20–30 min" gir 20 min). I
// redigeringsskjemaet kan den overstyres; overstyringen lagres som en skjult
// markør i stegteksten, f.eks. "{tid:25}", på samme måte som @-koblingene,
// så det trengs ingen skjemaendring. "{tid:0}" betyr "ingen nedtelling".

const MARKER = /\s*\{tid:(\d+(?:[.,]\d+)?)\}/g

function toNumber(value: string): number {
  return Number(value.replace(',', '.'))
}

// Stegteksten uten tidsmarkøren.
export function stripTimerMarker(step: string): string {
  return step.replace(MARKER, '')
}

// undefined = ingen overstyring (bruk gjettingen), null = ingen nedtelling,
// ellers antall minutter.
export function timerOverride(step: string): number | null | undefined {
  let minutes: number | undefined
  for (const match of step.matchAll(MARKER)) minutes = toNumber(match[1])
  if (minutes === undefined || !Number.isFinite(minutes)) return undefined
  return minutes > 0 ? minutes : null
}

// Setter, fjerner (null) eller nullstiller (undefined) overstyringen.
export function withTimerOverride(step: string, minutes: number | null | undefined): string {
  const text = stripTimerMarker(step)
  if (minutes === undefined) return text
  if (minutes === null || !(minutes > 0)) return `${text} {tid:0}`
  const rounded = Math.round(minutes * 10) / 10
  return `${text} {tid:${String(rounded)}}`
}

const NUM = String.raw`\d+(?:[.,]\d+)?`
const NOT_LETTER = String.raw`(?![\p{L}\p{N}])`
const UNIT = String.raw`(sekunder|sekund|sek|minutter|minutt|min|timer|time|t)`
const DURATION = new RegExp(
  String.raw`(?<![\p{L}\p{N},.])(${NUM})(?:\s*(?:-|–|—|til)\s*(${NUM}))?\s*${UNIT}\.?${NOT_LETTER}`,
  'gu'
)

const WORD_NUMBERS: Record<string, string> = {
  en: '1', én: '1', ett: '1', et: '1', ei: '1', to: '2', tre: '3', fire: '4', fem: '5',
  seks: '6', sju: '7', syv: '7', åtte: '8', ni: '9', ti: '10', femten: '15', tjue: '20',
}

// Gjør om tallord og faste uttrykk til tall, så ett regulært uttrykk holder.
function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/(?<![\p{L}])(?:tre)\s+kvarter(?![\p{L}])/gu, '45 min')
    .replace(/(?<![\p{L}])(?:et|ett|ei)\s+kvarter(?![\p{L}])/gu, '15 min')
    .replace(/(?<![\p{L}])halvannen\s+(?=time|timer)/gu, '1,5 ')
    .replace(/(?<![\p{L}])(?:en|én|ei|ett)\s+halv\s+(?=time)/gu, '0,5 ')
    .replace(/(?<![\p{L}])(\d+)\s+og\s+en\s+halv\s+(?=time)/gu, '$1,5 ')
    .replace(
      /(?<![\p{L}])(en|én|ett|et|ei|to|tre|fire|fem|seks|sju|syv|åtte|ni|ti|femten|tjue)\s+(?=(?:sekund|sek|minutt|min|time|timer)(?![\p{L}])|(?:sekunder|minutter)(?![\p{L}]))/gu,
      (_, word: string) => `${WORD_NUMBERS[word]} `
    )
}

const UNIT_SECONDS: Record<string, number> = {
  sekunder: 1, sekund: 1, sek: 1,
  minutter: 60, minutt: 60, min: 60,
  timer: 3600, time: 3600, t: 3600,
}

// Første tid som nevnes i teksten, i sekunder. Ved et intervall
// ("20–30 min") brukes det laveste tallet. "1 time og 15 min" og
// "1 t 30 min" legges sammen.
export function guessStepSeconds(text: string): number | null {
  const normalized = normalize(stripTimerMarker(text))
  const matches = [...normalized.matchAll(DURATION)]
  if (matches.length === 0) return null

  const first = matches[0]
  let seconds = toNumber(first[1]) * UNIT_SECONDS[first[3]]

  const firstIsHours = UNIT_SECONDS[first[3]] === 3600 && first[2] === undefined
  const next = matches[1]
  if (firstIsHours && next && next[2] === undefined && UNIT_SECONDS[next[3]] === 60) {
    const between = normalized.slice((first.index ?? 0) + first[0].length, next.index)
    if (/^\s*(?:og|,)?\s*$/.test(between)) seconds += toNumber(next[1]) * 60
  }

  if (!Number.isFinite(seconds) || seconds <= 0) return null
  return Math.round(Math.min(seconds, 48 * 3600))
}

// Tiden kokemodus skal foreslå for steget: overstyringen hvis den finnes,
// ellers gjettingen fra teksten.
export function stepTimerSeconds(step: string): number | null {
  const override = timerOverride(step)
  if (override === null) return null
  if (override !== undefined) return Math.round(override * 60)
  return guessStepSeconds(step)
}

// "20 min", "1 t 30 min", "45 sek"
export function formatDuration(seconds: number): string {
  const total = Math.max(0, Math.round(seconds))
  if (total < 60) return `${total} sek`
  const hours = Math.floor(total / 3600)
  const minutes = Math.round((total % 3600) / 60)
  if (hours === 0) return `${minutes} min`
  return minutes === 0 ? `${hours} t` : `${hours} t ${minutes} min`
}

// Nedtelling som klokke: "19:59", "1:05:00". Runder opp, så "0:00" først
// vises når tiden faktisk er ute.
export function formatClock(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000))
  const hours = Math.floor(total / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  const seconds = total % 60
  const pad = (n: number) => String(n).padStart(2, '0')
  return hours > 0 ? `${hours}:${pad(minutes)}:${pad(seconds)}` : `${minutes}:${pad(seconds)}`
}
