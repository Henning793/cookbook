import { useEffect, useState } from 'react'
import { Share2 } from 'lucide-react'
import { linkUrl, type LinkKind } from '../lib/inviteLinks'

interface Props {
  kind: LinkKind
  title: string
  body: string
  // Teksten som står foran lenken i meldingen, f.eks. «Bli med i Hansen i Kokeboka:».
  shareText: string
  createToken: () => Promise<string>
  onClose: () => void
}

/**
 * Lager en lenke som varer i 24 timer, og lar brukeren sende den med
 * telefonens delingsmeny (SMS osv.) eller kopiere den.
 */
export function DelLenkeDialog({ kind, title, body, shareText, createToken, onClose }: Props) {
  const [link, setLink] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  // Lenken lages når dialogen åpnes, ikke ved trykk på «Send»: delingsmenyen
  // må åpnes direkte fra trykket, uten å vente på et nettverkskall først.
  useEffect(() => {
    let active = true
    createToken()
      .then((token) => {
        if (active) setLink(linkUrl(kind, token))
      })
      .catch((err) => {
        if (active) setError(err instanceof Error ? err.message : 'Noe gikk feil.')
      })
    return () => {
      active = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const canShare = typeof navigator.share === 'function'

  async function copy() {
    if (!link) return
    try {
      await navigator.clipboard.writeText(link)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // Utklippstavle utilgjengelig - lenken står synlig og kan markeres for hånd.
    }
  }

  async function share() {
    if (!link) return
    try {
      await navigator.share({ title, text: shareText, url: link })
    } catch {
      // Brukeren lukket delingsmenyen, eller den er utilgjengelig - lenken kan kopieres i stedet.
    }
  }

  return (
    <div className="del-dialog-backdrop" onClick={onClose}>
      <div className="del-dialog-sheet" onClick={(e) => e.stopPropagation()}>
        <h2 className="del-dialog-title">{title}</h2>
        <p className="del-dialog-body">{body} Lenken varer i 24 timer.</p>

        {error ? (
          <p className="status-message">{error}</p>
        ) : (
          <div className="familie-invite-row">
            <span className="del-dialog-link">{link ?? 'Lager lenke...'}</span>
            <button type="button" className="familie-invite-copy" onClick={copy} disabled={!link}>
              {copied ? 'Kopiert!' : 'Kopier'}
            </button>
          </div>
        )}

        <div className="del-dialog-actions">
          <button type="button" className="del-dialog-cancel" onClick={onClose}>
            Lukk
          </button>
          {canShare && !error && (
            <button type="button" className="del-dialog-submit" onClick={share} disabled={!link}>
              <Share2 size={15} strokeWidth={2.5} aria-hidden="true" /> Send
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
