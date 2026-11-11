// Handlelisten viser varene fra ukesmenyen og egne varer i én liste.
// Ren logikk uten supabase-import, så den kan testes med node --test.
import { normalizeItemName } from './shoppingAggregate.ts'
import { sortShoppingItems } from './shoppingSort.ts'

interface RecipeLike {
  normalizedName: string
  displayName: string
  checked: boolean
}

interface ManualLike {
  id: string
  name: string
  checked: boolean
}

// En rad i listen: en vare fra ukesmenyen (med egne varer som har samme navn
// slått inn i seg), eller en egen vare.
export type MergedRow<R, M> = { kind: 'recipe'; item: R; manual: M[] } | { kind: 'manual'; item: M }

// En egen vare med samme navn som en vare fra ukesmenyen blir ikke egen rad,
// men hører til menyvaren (som viser menyens mengde). Har menyen samme vare i
// flere enheter, går den egne varen til den første.
export function mergeShoppingRows<R extends RecipeLike, M extends ManualLike>(
  recipeItems: readonly R[],
  manualItems: readonly M[]
): MergedRow<R, M>[] {
  const recipeRows = recipeItems.map((item) => ({ kind: 'recipe' as const, item, manual: [] as M[] }))
  const byName = new Map<string, (typeof recipeRows)[number]>()
  for (const row of recipeRows) {
    if (!byName.has(row.item.normalizedName)) byName.set(row.item.normalizedName, row)
  }
  const manualRows: MergedRow<R, M>[] = []
  for (const item of manualItems) {
    const match = byName.get(normalizeItemName(item.name))
    if (match) match.manual.push(item)
    else manualRows.push({ kind: 'manual', item })
  }
  return sortShoppingItems<MergedRow<R, M>>(
    [...recipeRows, ...manualRows],
    (row) => (row.kind === 'recipe' ? row.item.displayName : row.item.name),
    (row) => row.item.checked
  )
}

// Antall rader som ikke er krysset av.
export function countUnchecked(rows: readonly MergedRow<RecipeLike, ManualLike>[]): number {
  return rows.filter((row) => !row.item.checked).length
}

// Rettene uten oppskrift samlet per dag, i samme rekkefølge som dagene.
export function freetextByDay<E extends { date: string; text: string }>(
  entries: readonly E[]
): { date: string; texts: string[] }[] {
  const days: { date: string; texts: string[] }[] = []
  for (const entry of entries) {
    const day = days.find((d) => d.date === entry.date)
    if (day) day.texts.push(entry.text)
    else days.push({ date: entry.date, texts: [entry.text] })
  }
  return days
}
