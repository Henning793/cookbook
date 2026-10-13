// Ren logikk for å bytte to dager i ukesmenyen. Alt som hører til dagen
// (retter, fritekst og porsjoner) følger med, og ukedagene står i ro.
import type { MenuDay } from '../types'
import { extraDishes } from './menuDishes.ts'

export type MenuDayContent = Pick<MenuDay, 'entry_type' | 'recipe_id' | 'freetext' | 'servings' | 'extra_dishes'>

const EMPTY: MenuDayContent = { entry_type: null, recipe_id: null, freetext: null, servings: null, extra_dishes: [] }

export function dayContent(day: MenuDay | undefined): MenuDayContent {
  if (!day || !day.entry_type) return EMPTY
  return {
    entry_type: day.entry_type,
    recipe_id: day.recipe_id,
    freetext: day.freetext,
    servings: day.servings ?? null,
    extra_dishes: extraDishes(day),
  }
}

export function isEmptyDay(day: MenuDay | undefined): boolean {
  return !day || !day.entry_type
}

// Bytter innholdet i to ukedager i en lokal liste, til visning før
// lagringen er ferdig. Mangler en dag i lista, lages en tom plassholder.
export function swapDaysLocal(days: MenuDay[], a: number, b: number): MenuDay[] {
  if (a === b) return days
  const find = (weekday: number) => days.find((d) => d.weekday === weekday)
  const dayA = find(a)
  const dayB = find(b)
  const template = dayA ?? dayB
  if (!template) return days
  const withContent = (weekday: number, existing: MenuDay | undefined, content: MenuDayContent): MenuDay => ({
    ...(existing ?? { ...template, id: `lokal-${weekday}` }),
    weekday,
    ...content,
  })
  const nextA = withContent(a, dayA, dayContent(dayB))
  const nextB = withContent(b, dayB, dayContent(dayA))
  const rest = days.filter((d) => d.weekday !== a && d.weekday !== b)
  return [...rest, nextA, nextB].sort((x, y) => x.weekday - y.weekday)
}

const DAY_NAMES = ['mandag', 'tirsdag', 'onsdag', 'torsdag', 'fredag', 'lørdag', 'søndag']

// Meldingen etter et bytte. `from` er dagen som ble dratt, og `days` er
// lista slik den så ut før byttet.
export function swapMessage(days: MenuDay[], from: number, to: number): string {
  const target = days.find((d) => d.weekday === to)
  if (isEmptyDay(target)) return `Flyttet til ${DAY_NAMES[to]}`
  const [first, second] = from < to ? [from, to] : [to, from]
  return `Byttet ${DAY_NAMES[first]} og ${DAY_NAMES[second]}`
}
