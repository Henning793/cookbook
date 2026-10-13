import { useEffect, useRef, useState } from 'react'
import { EllipsisVertical } from 'lucide-react'

export interface RowMenuItem {
  label: string
  onSelect: () => void
  disabled?: boolean
}

export interface RowMenuSection {
  heading?: string
  items: RowMenuItem[]
}

interface Props {
  label: string
  sections: RowMenuSection[]
}

// Liten meny bak «⋮» på hver rad: flytt opp/ned, og for ingredienser
// også «Flytt til» en annen komponent. Et alternativ til å dra.
export function RowMenu({ label, sections }: Props) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function close(e: PointerEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    function onKey(e: globalThis.KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', close)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', close)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const visible = sections.filter((section) => section.items.length > 0)

  return (
    <div className="row-menu" ref={rootRef}>
      <button
        type="button"
        className="row-move row-menu-toggle"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <EllipsisVertical size={16} aria-hidden="true" />
      </button>
      {open && (
        <div className="row-menu-list" role="menu">
          {visible.map((section, sectionIndex) => (
            <div className="row-menu-section" key={sectionIndex}>
              {section.heading && <p className="row-menu-heading">{section.heading}</p>}
              {section.items.map((item, itemIndex) => (
                <button
                  type="button"
                  role="menuitem"
                  key={itemIndex}
                  className="row-menu-item"
                  disabled={item.disabled}
                  onClick={() => {
                    setOpen(false)
                    item.onSelect()
                  }}
                >
                  {item.label}
                </button>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
