// Uker i ukesmenyen. En uke identifiseres av mandagen sin som 'YYYY-MM-DD'
// (menu_days.week_start), regnet i lokal tid.

const MONTHS = [
  'januar', 'februar', 'mars', 'april', 'mai', 'juni',
  'juli', 'august', 'september', 'oktober', 'november', 'desember',
]

export function toIsoDate(date: Date): string {
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${m}-${d}`
}

function parseIsoDate(value: string): Date {
  const [y, m, d] = value.split('-').map(Number)
  return new Date(y, m - 1, d)
}

// 0 = mandag ... 6 = søndag, som menu_days.weekday.
export function isoWeekday(date: Date): number {
  return (date.getDay() + 6) % 7
}

export function weekStartOf(date: Date): string {
  const monday = new Date(date.getFullYear(), date.getMonth(), date.getDate() - isoWeekday(date))
  return toIsoDate(monday)
}

export function currentWeekStart(now: Date = new Date()): string {
  return weekStartOf(now)
}

export function addWeeks(weekStart: string, weeks: number): string {
  const date = parseIsoDate(weekStart)
  date.setDate(date.getDate() + weeks * 7)
  return toIsoDate(date)
}

// Gyldig mandag fra URL-en (?uke=), ellers null.
export function parseWeekParam(value: string | null): string | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
  const date = parseIsoDate(value)
  if (toIsoDate(date) !== value || isoWeekday(date) !== 0) return null
  return value
}

export function dayDate(weekStart: string, weekday: number): Date {
  const date = parseIsoDate(weekStart)
  date.setDate(date.getDate() + weekday)
  return date
}

// ISO-ukenummer: uken som inneholder torsdagen.
export function weekNumber(weekStart: string): number {
  const thursday = dayDate(weekStart, 3)
  const jan1 = new Date(thursday.getFullYear(), 0, 1)
  const dayOfYear = Math.round((thursday.getTime() - jan1.getTime()) / 86400000)
  return Math.floor(dayOfYear / 7) + 1
}

// «12.–18. oktober», eller «26. oktober–1. november» over et månedsskifte.
export function weekRangeLabel(weekStart: string): string {
  const first = dayDate(weekStart, 0)
  const last = dayDate(weekStart, 6)
  if (first.getMonth() === last.getMonth()) {
    return `${first.getDate()}.–${last.getDate()}. ${MONTHS[last.getMonth()]}`
  }
  return `${first.getDate()}. ${MONTHS[first.getMonth()]}–${last.getDate()}. ${MONTHS[last.getMonth()]}`
}

// Om dagen er passert (før i dag).
export function isPastDay(weekStart: string, weekday: number, now: Date = new Date()): boolean {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  return dayDate(weekStart, weekday).getTime() < today.getTime()
}

// Ukene man kan kopiere til: denne og de neste ukene, uten uken man kopierer fra.
export function copyTargetWeeks(from: string, now: Date = new Date(), count = 6): string[] {
  const current = currentWeekStart(now)
  const weeks: string[] = []
  for (let i = 0; i < count + 1 && weeks.length < count; i++) {
    const week = addWeeks(current, i)
    if (week !== from) weeks.push(week)
  }
  return weeks
}

// Datoen til en dag i ukesmenyen, 'YYYY-MM-DD'. Dager uten week_start (før
// migration_ukesmeny_flere_uker.sql) hører til denne uken.
export function menuDayDate(day: { week_start?: string; weekday: number }, now: Date = new Date()): string {
  return toIsoDate(dayDate(day.week_start ?? currentWeekStart(now), day.weekday))
}
