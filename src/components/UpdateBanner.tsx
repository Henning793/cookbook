import { useEffect, useRef } from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'
import { startUpdateChecks } from '../lib/swUpdateChecks'

// Shows a banner at the top of the screen when a new version of the app has
// been downloaded and is waiting. Tapping it activates the new service worker
// and reloads the page.
export function UpdateBanner() {
  const stopChecksRef = useRef<(() => void) | null>(null)

  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_swUrl, registration) {
      if (!registration) return
      stopChecksRef.current?.()
      stopChecksRef.current = startUpdateChecks(registration)
    },
  })

  useEffect(() => () => stopChecksRef.current?.(), [])

  if (!needRefresh) return null

  return (
    <button
      type="button"
      className="update-banner"
      role="status"
      onClick={() => void updateServiceWorker(true)}
    >
      Ny oppdatering tilgjengelig: <span className="update-banner-action">Oppdater</span>
    </button>
  )
}
