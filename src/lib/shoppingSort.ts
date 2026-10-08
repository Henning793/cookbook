// Handlelisten vises alfabetisk (norsk sortering, æ/ø/å til slutt, uten
// hensyn til store/små bokstaver). Avkryssede varer legges fortsatt nederst,
// og sorteres alfabetisk der også.
const collator = new Intl.Collator('nb', { sensitivity: 'base' })

export function sortShoppingItems<T>(
  items: readonly T[],
  name: (item: T) => string,
  isChecked: (item: T) => boolean
): T[] {
  return [...items].sort(
    (a, b) => Number(isChecked(a)) - Number(isChecked(b)) || collator.compare(name(a), name(b))
  )
}
