import { listMenuDays, resetMenu } from './menuDays'
import { deleteAllManualItems, listManualItems } from './shoppingList'
import { deleteAllStandingItems, listStandingItems } from './standingItems'

// Å bli medlem av en familie forkaster en eventuell aktiv personlig
// ukesmeny/handleliste (inkludert egne og faste varer) i stedet for å slå
// den sammen med familiens. Brukeren advares først hvis det finnes noe.

export async function hasPersonalMenuData(): Promise<boolean> {
  const [days, manual, alwaysHome, weekly] = await Promise.all([
    listMenuDays(null),
    listManualItems(null),
    listStandingItems(null, 'always_home'),
    listStandingItems(null, 'weekly'),
  ])
  return days.length > 0 || manual.length > 0 || alwaysHome.length > 0 || weekly.length > 0
}

export async function discardPersonalMenuData(): Promise<void> {
  await Promise.all([resetMenu(null), deleteAllManualItems(null), deleteAllStandingItems(null)])
}
