export const TAGS = [
  'Middag',
  'Lunsj',
  'Frokost',
  'Dessert',
  'Forrett',
  'Tilbehør',
  'Saus',
  'Bakst',
  'Vegetar',
] as const

// Brukes som ruteverdi (URL-slug) for samlingen som fanger opp oppskrifter
// uten noen etikett. Aldri lagret i recipes.tags - kun en intern
// identifikator for /samling/:tag.
export const UNTAGGED_TAG = '__ikke-merket__'
export const UNTAGGED_LABEL = 'Ikke merket'
