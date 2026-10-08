// Periodically asks the browser to look for a new service worker, and also
// whenever the app comes back to the foreground (e.g. reopened from the
// phone's app switcher). When a new version is found, vite-plugin-pwa flags
// `needRefresh` and the update banner appears.

export const UPDATE_CHECK_INTERVAL_MS = 60 * 60 * 1000 // 1 hour

export interface UpdatableRegistration {
  update: () => Promise<unknown>
}

export interface UpdateCheckEnv {
  setInterval: (callback: () => void, ms: number) => unknown
  clearInterval: (id: unknown) => void
  document: Pick<Document, 'addEventListener' | 'removeEventListener' | 'visibilityState'>
  isOnline: () => boolean
}

function browserEnv(): UpdateCheckEnv {
  return {
    setInterval: (callback, ms) => window.setInterval(callback, ms),
    clearInterval: (id) => window.clearInterval(id as number),
    document,
    isOnline: () => navigator.onLine,
  }
}

/** Starts update checks and returns a function that stops them. */
export function startUpdateChecks(
  registration: UpdatableRegistration,
  intervalMs = UPDATE_CHECK_INTERVAL_MS,
  env: UpdateCheckEnv = browserEnv()
): () => void {
  function check() {
    if (!env.isOnline()) return
    // A failed check (flaky network, server hiccup) just waits for the next one.
    registration.update().catch(() => {})
  }

  function onVisibilityChange() {
    if (env.document.visibilityState === 'visible') check()
  }

  const intervalId = env.setInterval(check, intervalMs)
  env.document.addEventListener('visibilitychange', onVisibilityChange)

  return () => {
    env.clearInterval(intervalId)
    env.document.removeEventListener('visibilitychange', onVisibilityChange)
  }
}
