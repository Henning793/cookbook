// Kokemodus skal ikke bli liggende igjen i nettleserhistorikken når man
// avslutter - ellers går tilbake-sveip fra oppskriften rett inn i kokemodus igjen.

// Sendes som navigasjons-state når kokemodus åpnes fra oppskriftssiden.
export const FROM_RECIPE_STATE = { fromRecipe: true } as const

export type KokemodusExit = { back: true } | { back: false; to: string }

// Åpnet fra oppskriftssiden ligger oppskriften rett under i historikken, så da
// går vi ett steg tilbake. Ellers (Fortsett på forsiden, varsel, direkte lenke)
// erstattes kokemodus-oppføringen med oppskriften.
export function kokemodusExit(recipeId: string | undefined, state: unknown): KokemodusExit {
  const fromRecipe =
    typeof state === 'object' && state !== null && (state as { fromRecipe?: unknown }).fromRecipe === true
  return fromRecipe ? { back: true } : { back: false, to: `/oppskrift/${recipeId}` }
}
