import { useEffect, useRef, useState, type ReactNode, type PointerEvent as ReactPointerEvent } from 'react'
import { CalendarPlus } from 'lucide-react'

// En rad i en samling som kan dras mot venstre (eller holdes inne) for å
// legge oppskriften i ukesmenyen. Et vanlig trykk åpner oppskriften, og
// scrolling opp og ned virker som før.

const HOLD_DELAY = 450
const MOVE_TOLERANCE = 10
// Så langt raden må dras før arket åpnes når man slipper.
const OPEN_AT = 70
const MAX_PULL = 120

interface Press {
  pointerId: number
  startX: number
  startY: number
  moved: boolean
  horizontal: boolean
  timer: number
  cleanup: () => void
}

interface Props {
  title: string
  onClick: () => void
  onAddToMenu: () => void
  children: ReactNode
}

export function SwipeToMenuRow({ title, onClick, onAddToMenu, children }: Props) {
  const [offset, setOffset] = useState(0)
  const [dragging, setDragging] = useState(false)
  const press = useRef<Press | null>(null)
  const offsetRef = useRef(0)
  // Et dra eller langt trykk skal ikke også åpne oppskriften når fingeren slippes.
  const swallowClick = useRef(false)
  const onAddRef = useRef(onAddToMenu)

  useEffect(() => {
    onAddRef.current = onAddToMenu
  })

  function setPull(value: number) {
    offsetRef.current = value
    setOffset(value)
  }

  function stop() {
    const state = press.current
    press.current = null
    if (state) {
      window.clearTimeout(state.timer)
      state.cleanup()
    }
  }

  useEffect(() => () => stop(), [])

  function handlePointerDown(e: ReactPointerEvent<HTMLButtonElement>) {
    if (e.pointerType === 'mouse' && e.button !== 0) return
    stop()
    swallowClick.current = false

    function reset() {
      stop()
      setDragging(false)
      setPull(0)
    }

    function handleMove(ev: PointerEvent) {
      if (press.current !== state || ev.pointerId !== state.pointerId) return
      const dx = ev.clientX - state.startX
      const dy = ev.clientY - state.startY
      if (!state.moved) {
        if (Math.abs(dx) < MOVE_TOLERANCE && Math.abs(dy) < MOVE_TOLERANCE) return
        state.moved = true
        window.clearTimeout(state.timer)
        // Bare dra mot venstre flytter raden; alt annet er vanlig scrolling.
        if (Math.abs(dx) <= Math.abs(dy) || dx > 0) {
          stop()
          return
        }
        state.horizontal = true
        swallowClick.current = true
        setDragging(true)
      }
      setPull(Math.max(-MAX_PULL, Math.min(0, dx)))
    }

    function handleUp(ev: PointerEvent) {
      if (press.current !== state || ev.pointerId !== state.pointerId) return
      const open = state.horizontal && offsetRef.current <= -OPEN_AT
      reset()
      if (open) onAddRef.current()
    }

    const state: Press = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      moved: false,
      horizontal: false,
      timer: window.setTimeout(() => {
        if (press.current !== state || state.moved) return
        swallowClick.current = true
        stop()
        navigator.vibrate?.(10)
        onAddRef.current()
      }, HOLD_DELAY),
      cleanup: () => {
        window.removeEventListener('pointermove', handleMove)
        window.removeEventListener('pointerup', handleUp)
        window.removeEventListener('pointercancel', reset)
      },
    }
    press.current = state
    window.addEventListener('pointermove', handleMove)
    window.addEventListener('pointerup', handleUp)
    window.addEventListener('pointercancel', reset)
  }

  return (
    <div className="samling-swipe">
      <button
        type="button"
        className="samling-swipe-action"
        aria-label={`Legg ${title} i ukesmenyen`}
        onClick={onAddToMenu}
      >
        <CalendarPlus size={20} strokeWidth={2} aria-hidden="true" />
        Ukesmeny
      </button>
      <button
        type="button"
        className={`samling-recipe-row samling-swipe-front${dragging ? ' samling-swipe-dragging' : ''}`}
        style={offset ? { transform: `translateX(${offset}px)` } : undefined}
        onPointerDown={handlePointerDown}
        onContextMenu={(e) => e.preventDefault()}
        onClick={() => {
          if (swallowClick.current) {
            swallowClick.current = false
            return
          }
          onClick()
        }}
      >
        {children}
      </button>
    </div>
  )
}
