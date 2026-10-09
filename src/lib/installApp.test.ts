import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  DISMISSED_KEY,
  dismissBanner,
  installMethod,
  isBannerDismissed,
  isIos,
  type InstallEnv,
} from './installApp.ts'

const IPHONE_SAFARI =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1'
const IPHONE_CHROME =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/140.0.7339.101 Mobile/15E148 Safari/604.1'
const IPHONE_FIREFOX =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) FxiOS/143.0 Mobile/15E148 Safari/605.1.15'
const IPHONE_INSTAGRAM =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 390.0.0.28.85'
const IPHONE_FACEBOOK =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [FBAN/FBIOS;FBAV/520.0.0.38.101]'
// iPadOS ber om «skrivebordsversjon» og ser derfor ut som en Mac.
const IPAD_SAFARI =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Safari/605.1.15'
const ANDROID_CHROME =
  'Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36'
const ANDROID_FIREFOX = 'Mozilla/5.0 (Android 15; Mobile; rv:143.0) Gecko/143.0 Firefox/143.0'

function env(overrides: Partial<InstallEnv>): InstallEnv {
  return { userAgent: ANDROID_CHROME, maxTouchPoints: 5, standalone: false, hasPrompt: false, ...overrides }
}

test('isIos: kjenner igjen iPhone, og iPad som utgir seg for å være Mac', () => {
  assert.equal(isIos(IPHONE_SAFARI, 5), true)
  assert.equal(isIos(IPAD_SAFARI, 5), true)
  assert.equal(isIos(IPAD_SAFARI, 0), false) // en ekte Mac har ikke berøringsskjerm
  assert.equal(isIos(ANDROID_CHROME, 5), false)
})

test('installMethod: installert app får aldri tilbudet', () => {
  assert.equal(installMethod(env({ standalone: true, hasPrompt: true })), 'none')
  assert.equal(installMethod(env({ userAgent: IPHONE_SAFARI, standalone: true })), 'none')
})

test('installMethod: nettleser med installeringsdialog bruker den', () => {
  assert.equal(installMethod(env({ hasPrompt: true })), 'prompt')
})

test('installMethod: Safari på iPhone og iPad får veiledningen', () => {
  assert.equal(installMethod(env({ userAgent: IPHONE_SAFARI })), 'ios-safari')
  assert.equal(installMethod(env({ userAgent: IPAD_SAFARI })), 'ios-safari')
})

test('installMethod: andre nettlesere på iOS sendes til Safari', () => {
  for (const userAgent of [IPHONE_CHROME, IPHONE_FIREFOX, IPHONE_INSTAGRAM, IPHONE_FACEBOOK]) {
    assert.equal(installMethod(env({ userAgent })), 'ios-other', userAgent)
  }
})

test('installMethod: nettlesere uten støtte får ingenting', () => {
  assert.equal(installMethod(env({ userAgent: ANDROID_FIREFOX })), 'none')
  assert.equal(installMethod(env({ userAgent: ANDROID_CHROME })), 'none') // før hendelsen har kommet
  assert.equal(installMethod(env({ userAgent: IPAD_SAFARI, maxTouchPoints: 0 })), 'none') // Mac
})

function makeStore() {
  const values = new Map<string, string>()
  return {
    values,
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => void values.set(key, value),
  }
}

test('lukket banner huskes', () => {
  const store = makeStore()
  assert.equal(isBannerDismissed(store), false)
  dismissBanner(store)
  assert.equal(store.values.has(DISMISSED_KEY), true)
  assert.equal(isBannerDismissed(store), true)
})

test('lagring som kaster krasjer ikke', () => {
  const broken = {
    getItem: () => {
      throw new Error('blokkert')
    },
    setItem: () => {
      throw new Error('blokkert')
    },
  }
  assert.equal(isBannerDismissed(broken), false)
  assert.doesNotThrow(() => dismissBanner(broken))
})
