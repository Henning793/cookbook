// Ren flyttelogikk for redigeringsskjemaet: rekkefølge i én liste, og
// ingredienser mellom gruppene (løse ingredienser og komponenter).

export interface SortPosition {
  group: number
  index: number
}

// Flytter elementet på `from` slik at det havner på plass `to` i resultatet.
export function moveTo<T>(items: T[], from: number, to: number): T[] {
  if (from < 0 || from >= items.length) return items
  const target = Math.max(0, Math.min(to, items.length - 1))
  if (target === from) return items
  const copy = [...items]
  const [item] = copy.splice(from, 1)
  copy.splice(target, 0, item)
  return copy
}

// Flytter en rad fra én gruppe til en annen (eller innad i samme gruppe).
// `to.index` er plassen i målgruppen etter at raden er tatt ut, så
// `to.index` = antall rader i målgruppen legger den sist.
export function moveBetweenGroups<T, G extends { rows: T[] }>(groups: G[], from: SortPosition, to: SortPosition): G[] {
  const source = groups[from.group]
  const target = groups[to.group]
  if (!source || !target || from.index < 0 || from.index >= source.rows.length) return groups
  const row = source.rows[from.index]
  const withoutRow = groups.map((group, i) =>
    i === from.group ? { ...group, rows: group.rows.filter((_, r) => r !== from.index) } : group
  )
  const targetRows = withoutRow[to.group].rows
  const index = Math.max(0, Math.min(to.index, targetRows.length))
  if (to.group === from.group && index === from.index) return groups
  return withoutRow.map((group, i) =>
    i === to.group ? { ...group, rows: [...targetRows.slice(0, index), row, ...targetRows.slice(index)] } : group
  )
}
