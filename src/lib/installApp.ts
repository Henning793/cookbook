// «Installer appen»: finner ut hvordan Kokeboka kan installeres fra
// nettleseren brukeren sitter i, og husker om banneret er lukket.
//
// - Chrome/Edge (Android og PC) sender `beforeinstallprompt`, som lar oss åpne
//   nettleserens egen installeringsdialog fra vår egen knapp.
// - iOS har ikke noe slikt API. Der må brukeren selv velge «Legg til på
//   Hjem-skjerm» fra Del-menyen i Safari, så vi viser en veiledning.

// `beforeinstallprompt` er ikke en del av lib.dom.d.ts ennå.
export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

// 'prompt':     nettleseren har gitt oss en installeringsdialog vi kan åpne
// 'ios-safari': vis veiledningen for Del-menyen
// 'ios-other':  annen nettleser på iOS – be brukeren åpne siden i Safari
// 'none':       allerede installert, eller nettleseren støtter ikke installering
export type InstallMethod = 'prompt' | 'ios-safari' | 'ios-other' | 'none'

export interface InstallEnv {
  userAgent: string
  maxTouchPoints: number
  // Appen kjører allerede som installert app (eget vindu, ikke nettleserfane).
  standalone: boolean
  hasPrompt: boolean
}

// iPadOS utgir seg for å være en Mac, men en Mac har ikke berøringsskjerm.
export function isIos(userAgent: string, maxTouchPoints: number): boolean {
  if (/iPhone|iPad|iPod/.test(userAgent)) return true
  return /Macintosh/.test(userAgent) && maxTouchPoints > 1
}

// Andre nettlesere og innebygde nettlesere i apper (Facebook, Instagram,
// Snapchat …) på iOS. Alle har «Safari» i user agent-en, så de må utelukkes
// ved navn.
const IOS_NON_SAFARI = /CriOS|FxiOS|EdgiOS|OPiOS|OPT\/|DuckDuckGo|GSA\/|FBAN|FBAV|FB_IAB|Instagram|Snapchat|Line\/|MicroMessenger/

export function installMethod(env: InstallEnv): InstallMethod {
  if (env.standalone) return 'none'
  if (env.hasPrompt) return 'prompt'
  if (!isIos(env.userAgent, env.maxTouchPoints)) return 'none'
  const isSafari = /Safari/.test(env.userAgent) && !IOS_NON_SAFARI.test(env.userAgent)
  return isSafari ? 'ios-safari' : 'ios-other'
}

// --- Lukket banner ---

export const DISMISSED_KEY = 'kokeboka:installer-banner-lukket'

type Store = Pick<Storage, 'getItem' | 'setItem'>

// localStorage kan kaste (f.eks. privat modus eller blokkert lagring). Da
// vises banneret bare igjen neste gang, i stedet for at appen krasjer.
export function isBannerDismissed(store: Store): boolean {
  try {
    return store.getItem(DISMISSED_KEY) !== null
  } catch {
    return false
  }
}

export function dismissBanner(store: Store): void {
  try {
    store.setItem(DISMISSED_KEY, '1')
  } catch {
    // Se isBannerDismissed.
  }
}

// --- Tilstand i nettleseren ---

interface InstallState {
  method: InstallMethod
  bannerDismissed: boolean
}

let promptEvent: BeforeInstallPromptEvent | null = null
let installed = false
let state: InstallState = { method: 'none', bannerDismissed: false }
const listeners = new Set<() => void>()

function isStandalone(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    // Safari på iOS sin egen variant.
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  )
}

function refresh() {
  state = {
    method: installMethod({
      userAgent: navigator.userAgent,
      maxTouchPoints: navigator.maxTouchPoints,
      standalone: installed || isStandalone(),
      hasPrompt: promptEvent !== null,
    }),
    bannerDismissed: isBannerDismissed(localStorage),
  }
  listeners.forEach((listener) => listener())
}

// `beforeinstallprompt` kan komme før React har tegnet noe, så det lyttes fra
// modulen lastes (importert i main.tsx) og ikke fra en komponent.
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (event) => {
    // Hindrer Chrome sin egen mini-infolinje; vi viser vårt eget banner.
    event.preventDefault()
    promptEvent = event as BeforeInstallPromptEvent
    refresh()
  })
  window.addEventListener('appinstalled', () => {
    promptEvent = null
    installed = true
    refresh()
  })
  refresh()
}

export function subscribeInstallState(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function getInstallState(): InstallState {
  return state
}

// Åpner nettleserens installeringsdialog. Hendelsen kan bare brukes én gang.
export async function promptInstall(): Promise<void> {
  const event = promptEvent
  if (!event) return
  promptEvent = null
  await event.prompt()
  await event.userChoice.catch(() => undefined)
  refresh()
}

export function dismissInstallBanner(): void {
  dismissBanner(localStorage)
  refresh()
}
