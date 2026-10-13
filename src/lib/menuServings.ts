// Porsjonsantall fra ukesmenyen sendes til oppskriftssiden som ?porsjoner=N,
// og navigasjons-state forteller at oppskriften ble åpnet fra ukesmenyen.

export const FROM_MENU_STATE = { fromMenu: true } as const

export function isFromMenu(state: unknown): boolean {
  return typeof state === 'object' && state !== null && (state as { fromMenu?: unknown }).fromMenu === true
}

// Adressen til oppskriften fra en dag i ukesmenyen. Antallet tas bare med når
// dagen har et eget antall (null = oppskriftens eget).
export function menuRecipePath(recipeId: string, servings: number | null): string {
  return `/oppskrift/${recipeId}` + (servings != null ? `?porsjoner=${servings}` : '')
}

// Ugyldig eller manglende verdi gir null, og da brukes oppskriftens eget antall.
export function parseServingsParam(value: string | null): number | null {
  if (value == null || value.trim() === '') return null
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null
}
