// Hvor langt frem handlelisten tar med varer fra ukesmenyen. Hver person
// velger selv under «Personaliser handlelisten» (se shoppingPreferences.ts).
// Alle valgene starter på mandag denne uken, så det som ikke er krysset av
// tidligere i uken blir med.
import { addWeeks, currentWeekStart, dayDate, menuDayDate, toIsoDate } from './menuWeeks.ts'

// week: ut denne uken (mandag–søndag), som før.
// next7: i dag og 6 dager frem.
// month: denne uken og de 4 neste.
export type ShoppingRange = 'week' | 'next7' | 'month'

export const DEFAULT_SHOPPING_RANGE: ShoppingRange = 'week'

export function isShoppingRange(value: unknown): value is ShoppingRange {
  return value === 'week' || value === 'next7' || value === 'month'
}

const MONTHS_SHORT = ['jan', 'feb', 'mar', 'apr', 'mai', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'des']
const WEEKDAYS_SHORT = ['Man', 'Tir', 'Ons', 'Tor', 'Fre', 'Lør', 'Søn']

function parseIsoDate(value: string): Date {
  const [y, m, d] = value.split('-').map(Number)
  return new Date(y, m - 1, d)
}

// Siste dag listen tar med, 'YYYY-MM-DD'.
export function rangeEnd(range: ShoppingRange, now: Date = new Date()): string {
  const monday = currentWeekStart(now)
  if (range === 'week') return toIsoDate(dayDate(monday, 6))
  if (range === 'month') return toIsoDate(dayDate(addWeeks(monday, 4), 6))
  return toIsoDate(new Date(now.getFullYear(), now.getMonth(), now.getDate() + 6))
}

// Første og siste uke (mandager) som må hentes for perioden.
export function rangeWeeks(range: ShoppingRange, now: Date = new Date()): { from: string; to: string } {
  const from = currentWeekStart(now)
  const end = parseIsoDate(rangeEnd(range, now))
  return { from, to: currentWeekStart(end) }
}

// Dagene fra mandag denne uken til og med end, sortert på dato.
export function daysInRange<T extends { week_start?: string; weekday: number }>(
  days: T[],
  end: string,
  now: Date = new Date()
): T[] {
  const from = currentWeekStart(now)
  return days
    .map((day) => ({ day, date: menuDayDate(day, now) }))
    .filter(({ date }) => date >= from && date <= end)
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
    .map(({ day }) => day)
}

export function rangeLabel(range: ShoppingRange): string {
  return range === 'month' ? 'Månedshandling' : 'Ukeshandling'
}

// «Tor 15.»
export function shortDayLabel(isoDate: string): string {
  const date = parseIsoDate(isoDate)
  return `${WEEKDAYS_SHORT[(date.getDay() + 6) % 7]} ${date.getDate()}.`
}

// «t.o.m. ons 21. okt»
export function rangeEndLabel(end: string): string {
  const date = parseIsoDate(end)
  return `t.o.m. ${WEEKDAYS_SHORT[(date.getDay() + 6) % 7].toLowerCase()} ${date.getDate()}. ${MONTHS_SHORT[date.getMonth()]}`
}
