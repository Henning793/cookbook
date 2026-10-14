// «I kveld»-kortet på forsiden: hva som står i ukesmenyen i dag, og om man
// har startet på det i kokemodus. Ren logikk uten supabase-import, så den kan
// testes med node --test.
import type { MenuDay, Recipe } from '../types.ts'
import type { CookingSession } from './cookingSession.ts'
import { dayKokemodusPath, dayPath } from './dayCooking.ts'
import { menuDayItems } from './menuDishes.ts'
import { menuRecipePath } from './menuServings.ts'

// Hvor man er kommet i kokemodus, og adressen «Fortsett» går til.
export interface CookingProgress {
  recipe: Recipe
  stepIndex: number
  totalSteps: number
  resumePath: string
}

export type TonightCard =
  // Ingenting planlagt i dag. Kortet går til ukesmenyen.
  | { kind: 'empty' }
  // Bare fritekst, f.eks. «Pizza og rester». Kortet går til ukesmenyen.
  | { kind: 'freetext'; title: string }
  // Én oppskrift (eventuelt med fritekst ved siden av). Kortet åpner oppskriften.
  // servings er antallet fra ukesmenyen når det er et annet enn oppskriftens eget.
  | {
      kind: 'recipe'
      title: string
      imageUrls: string[]
      servings: number | null
      openPath: string
      progress: CookingProgress | null
    }
  // To eller flere oppskrifter. Kortet åpner dagssiden.
  | {
      kind: 'day'
      title: string
      imageUrls: string[]
      dishCount: number
      openPath: string
      progress: CookingProgress | null
    }

// «Lasagne», «Lasagne og salat», «Taco, salat og nachos».
export function joinTitles(titles: string[]): string {
  if (titles.length <= 1) return titles[0] ?? ''
  return `${titles.slice(0, -1).join(', ')} og ${titles[titles.length - 1]}`
}

// Kokeøkten der man kom til, med adressen tilbake til samme sted. null når
// oppskriften er slettet. Samme adresse som «Fortsett» alltid har brukt.
export function cookingProgress(session: CookingSession | null, recipes: Recipe[]): CookingProgress | null {
  if (!session) return null
  const recipe = recipes.find((r) => r.id === session.recipeId)
  if (!recipe) return null
  return {
    recipe,
    stepIndex: session.stepIndex,
    totalSteps: recipe.steps.length,
    resumePath:
      session.weekday != null
        ? dayKokemodusPath(session.recipeId, session.weekday, null)
        : `/oppskrift/${session.recipeId}/kok`,
  }
}

// Kortet for dagens rad i ukesmenyen (weekday: 0 = mandag). session er
// kokeøkten, eller null når den er for gammel til å vises (se
// isRecentCookingSession).
export function tonightCard(
  day: MenuDay | null,
  weekday: number,
  recipes: Recipe[],
  session: CookingSession | null
): TonightCard {
  const items = day?.entry_type ? menuDayItems(day, recipes) : []
  if (items.length === 0) return { kind: 'empty' }

  const title = joinTitles(items.map((item) => item.title))
  const dishes = items.flatMap((item) => (item.dish ? [item.dish] : []))
  if (dishes.length === 0) return { kind: 'freetext', title }

  const imageUrls = dishes.flatMap((dish) => (dish.recipe.image_url ? [dish.recipe.image_url] : []))

  if (dishes.length >= 2) {
    // Dagssiden husker steget i hver rett, så alle retter på dagen teller.
    const cookingToday = session?.weekday === weekday && dishes.some((d) => d.recipe.id === session.recipeId)
    return {
      kind: 'day',
      title,
      imageUrls,
      dishCount: dishes.length,
      openPath: dayPath(weekday),
      progress: cookingToday ? cookingProgress(session, recipes) : null,
    }
  }

  const [dish] = dishes
  // Startet fra oppskriften eller fra dagen i ukesmenyen, men ikke fra en
  // annen dag.
  const cookingThis =
    session?.recipeId === dish.recipe.id && (session.weekday == null || session.weekday === weekday)
  const servings = dish.servings !== dish.base ? dish.servings : null
  return {
    kind: 'recipe',
    title,
    imageUrls,
    servings,
    openPath: menuRecipePath(dish.recipe.id, servings),
    progress: cookingThis ? cookingProgress(session, recipes) : null,
  }
}

// Kokeøkt som ikke hører til kveldens middag. Den vises i et eget kort under.
export function otherCooking(
  card: TonightCard,
  session: CookingSession | null,
  recipes: Recipe[]
): CookingProgress | null {
  if ((card.kind === 'recipe' || card.kind === 'day') && card.progress) return null
  return cookingProgress(session, recipes)
}
