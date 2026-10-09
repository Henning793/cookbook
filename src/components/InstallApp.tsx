import { useState, useSyncExternalStore } from 'react'
import { Share, SquarePlus, X } from 'lucide-react'
import {
  dismissInstallBanner,
  getInstallState,
  promptInstall,
  subscribeInstallState,
  type InstallMethod,
} from '../lib/installApp'

// Felles for banneret på forsiden og raden på profilsiden: hvordan appen kan
// installeres her, og en `install()` som enten åpner nettleserens dialog eller
// veiledningen for iOS. `guide` må tegnes av den som bruker hooken.
export function useInstallApp() {
  const { method, bannerDismissed } = useSyncExternalStore(subscribeInstallState, getInstallState)
  // Veiledningen husker hvilken variant den ble åpnet med, så den ikke
  // forsvinner under brukeren om tilstanden endrer seg mens den er oppe.
  const [guideFor, setGuideFor] = useState<InstallMethod | null>(null)

  function install() {
    if (method === 'prompt') void promptInstall()
    else if (method !== 'none') setGuideFor(method)
  }

  const guide =
    guideFor === 'ios-safari' ? (
      <SafariGuide onClose={() => setGuideFor(null)} />
    ) : guideFor === 'ios-other' ? (
      <OpenInSafariGuide onClose={() => setGuideFor(null)} />
    ) : null

  return { method, bannerDismissed, install, guide }
}

// Kort på forsiden som tilbyr å installere appen når den er åpnet i en
// nettleser. Ligger i sideflyten (ikke fixed), så det aldri dekker knapper.
export function InstallBanner() {
  const { method, bannerDismissed, install, guide } = useInstallApp()

  if (method === 'none' || bannerDismissed) return guide

  return (
    <>
      <div className="install-banner">
        <img className="install-banner-icon" src="/icons/icon-192.png" alt="" width={40} height={40} />
        <p className="install-banner-title">Få Kokeboka som app</p>
        <button type="button" className="install-banner-cta" onClick={install}>
          {method === 'prompt' ? 'Installer' : 'Vis hvordan'}
        </button>
        <button
          type="button"
          className="install-banner-close"
          aria-label="Lukk"
          onClick={dismissInstallBanner}
        >
          <X size={16} strokeWidth={2.5} aria-hidden="true" />
        </button>
      </div>
      {guide}
    </>
  )
}

function SafariGuide({ onClose }: { onClose: () => void }) {
  return (
    <div className="del-dialog-backdrop" onClick={onClose}>
      <div
        className="del-dialog-sheet install-guide"
        role="dialog"
        aria-modal="true"
        aria-labelledby="install-guide-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="del-dialog-title" id="install-guide-title">
          Legg Kokeboka på hjemskjermen
        </h2>
        <ol className="install-guide-steps">
          <li>
            <span className="install-guide-icon" aria-hidden="true">
              <Share size={18} strokeWidth={2.25} />
            </span>
            <span>
              Trykk på <strong>Del</strong>-ikonet i Safari. Ser du det ikke, trykk på{' '}
              <strong>···</strong> først.
            </span>
          </li>
          <li>
            <span className="install-guide-icon" aria-hidden="true">
              <SquarePlus size={18} strokeWidth={2.25} />
            </span>
            <span>
              Rull ned i menyen og velg <strong>Legg til på Hjem-skjerm</strong>.
            </span>
          </li>
          <li>
            <span className="install-guide-icon install-guide-icon-text" aria-hidden="true">
              3
            </span>
            <span>
              Trykk <strong>Legg til</strong> øverst til høyre.
            </span>
          </li>
        </ol>
        <div className="del-dialog-actions">
          <button type="button" className="del-dialog-submit" onClick={onClose}>
            Skjønner
          </button>
        </div>
      </div>
    </div>
  )
}

function OpenInSafariGuide({ onClose }: { onClose: () => void }) {
  const [copied, setCopied] = useState(false)

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(window.location.origin)
      setCopied(true)
    } catch {
      // Uten tilgang til utklippstavlen må adressen kopieres for hånd.
    }
  }

  return (
    <div className="del-dialog-backdrop" onClick={onClose}>
      <div
        className="del-dialog-sheet install-guide"
        role="dialog"
        aria-modal="true"
        aria-labelledby="install-guide-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="del-dialog-title" id="install-guide-title">
          Åpne Kokeboka i Safari
        </h2>
        <p className="del-dialog-body">
          På iPhone og iPad kan appen bare legges på hjemskjermen fra Safari. Kopier lenken, åpne
          Safari og lim den inn i adressefeltet.
        </p>
        <p className="install-guide-url">{window.location.host}</p>
        <div className="del-dialog-actions">
          <button type="button" className="del-dialog-cancel" onClick={onClose}>
            Lukk
          </button>
          <button type="button" className="del-dialog-submit" onClick={copyLink}>
            {copied ? 'Kopiert' : 'Kopier lenke'}
          </button>
        </div>
      </div>
    </div>
  )
}
