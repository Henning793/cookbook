// Appen bruker BrowserRouter, som ikke styrer scrollposisjonen selv. Uten
// dette blir siden stående like langt nede som forrige side var scrollet når
// man åpner en oppskrift fra listen.

export type NavigationType = 'POP' | 'PUSH' | 'REPLACE'

export type ScrollAction = { kind: 'top' } | { kind: 'restore'; y: number } | { kind: 'keep' }

// Hva som skal skje med scrollen etter en navigasjon. Tilbake/frem (POP)
// henter frem posisjonen siden hadde sist den var åpen. Ny side (PUSH eller
// REPLACE til en annen sti) starter øverst. Bare søkeparameteren endres,
// f.eks. bytte rett på dagssiden eller uke i ukesmenyen: bli stående.
export function scrollAction(
  type: NavigationType,
  fromPath: string | null,
  toPath: string,
  saved: number | undefined,
): ScrollAction {
  if (type === 'POP') return saved !== undefined ? { kind: 'restore', y: saved } : { kind: 'top' }
  if (fromPath === toPath) return { kind: 'keep' }
  return { kind: 'top' }
}
