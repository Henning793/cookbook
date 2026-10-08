import {
  Beef,
  BookOpen,
  CakeSlice,
  CookingPot,
  Cookie,
  Croissant,
  Drumstick,
  EggFried,
  Fish,
  GlassWater,
  Milk,
  Salad,
  Sandwich,
  Soup,
  Sprout,
  type LucideIcon,
} from 'lucide-react'

// Første treff vinner, så de mest spesifikke ordene står først.
const ICON_KEYWORDS: [string[], LucideIcon][] = [
  [['dessert', 'kake', 'søt', 'is'], CakeSlice],
  [['bakst', 'brød', 'bake', 'gjær'], Croissant],
  [['småkake', 'kjeks', 'snacks'], Cookie],
  [['salat'], Salad],
  [['suppe'], Soup],
  [['saus', 'dressing', 'marinade', 'dipp'], Milk],
  [['frokost', 'egg'], EggFried],
  [['lunsj', 'smørbrød', 'matpakke'], Sandwich],
  [['drikke', 'drink', 'smoothie'], GlassWater],
  [['fisk', 'sjømat'], Fish],
  [['kylling', 'fugl'], Drumstick],
  [['kjøtt', 'grill', 'biff'], Beef],
  [['tilbehør', 'vegetar', 'vegan', 'grønt'], Sprout],
  [['middag', 'hovedrett', 'hverdag', 'gryte'], CookingPot],
]

// Tegningen som vises for en samling uten bilder, valgt ut fra navnet.
// Ukjente navn (og «uten etikett») får en åpen bok.
export function collectionIcon(name: string): LucideIcon {
  const words = name.toLowerCase().split(/[^\p{L}]+/u)
  for (const [keywords, icon] of ICON_KEYWORDS) {
    // Hele ord eller starten av et ord ("kaker", "middager"), ikke treff midt
    // i et ord ("is" i "ris").
    if (keywords.some((keyword) => words.some((word) => word.startsWith(keyword)))) return icon
  }
  return BookOpen
}
