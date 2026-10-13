import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'

// Hold-og-dra for å bytte to dager i ukesmenyen, for både mus og finger.
// Et kort trykk og vanlig scrolling virker som før: raden løftes først når
// man har holdt i LIFT_DELAY ms uten å flytte seg. Radene merkes med
// data-swap-day="<ukedag>", og målet er raden fingeren er over.

const LIFT_DELAY = 350
// Raden krymper mens man drar og legger seg like over fingeren, så man ser
// dagen man er over.
const LIFTED_SCALE = 0.6
const FINGER_GAP = 14
const MOVE_TOLERANCE = 10
const EDGE = 70
const MAX_SCROLL_SPEED = 14

interface Press {
  weekday: number
  element: HTMLElement
  startX: number
  startY: number
  clientY: number
  offset: number
  lifted: boolean
  timer: number
}

export function useLongPressSwap(enabled: boolean, onSwap: (from: number, to: number) => void) {
  const [lifted, setLifted] = useState<number | null>(null)
  const [target, setTarget] = useState<number | null>(null)
  const press = useRef<Press | null>(null)
  const targetRef = useRef<number | null>(null)
  const frame = useRef(0)
  const onSwapRef = useRef(onSwap)

  useEffect(() => {
    onSwapRef.current = onSwap
  })

  useEffect(() => () => finish(false), [])

  // Lyttere som må finnes før fingeren treffer skjermen. Mobilnettlesere
  // avgjør ved berøringsstart om scrolling kan stoppes, og når fingeren
  // holdes lenge kommer en «contextmenu» der fingeren er (ikke lenger over
  // raden når den har krympet). Slippes de gjennom, avbryter nettleseren
  // draget og raden hopper tilbake.
  useEffect(() => {
    function blockScroll(e: TouchEvent) {
      if (press.current?.lifted) e.preventDefault()
    }
    function blockContextMenu(e: Event) {
      if (press.current) e.preventDefault()
    }
    document.addEventListener('touchmove', blockScroll, { passive: false })
    document.addEventListener('contextmenu', blockContextMenu, true)
    return () => {
      document.removeEventListener('touchmove', blockScroll)
      document.removeEventListener('contextmenu', blockContextMenu, true)
    }
  }, [])

  function findTarget(clientY: number, dragged: HTMLElement): number | null {
    const rows = [...document.querySelectorAll<HTMLElement>('[data-swap-day]')].filter((el) => el !== dragged)
    const row = rows.find((el) => {
      const rect = el.getBoundingClientRect()
      return clientY >= rect.top && clientY <= rect.bottom
    })
    return row ? Number(row.dataset.swapDay) : null
  }

  function update() {
    const state = press.current
    if (!state || !state.lifted) return
    // Ruller siden når fingeren er nær kanten, så man kan dra forbi skjermen.
    const { clientY } = state
    let speed = 0
    if (clientY < EDGE) speed = -MAX_SCROLL_SPEED * (1 - Math.max(clientY, 0) / EDGE)
    else if (clientY > window.innerHeight - EDGE)
      speed = MAX_SCROLL_SPEED * (1 - Math.max(window.innerHeight - clientY, 0) / EDGE)
    if (speed !== 0) window.scrollBy(0, speed)

    // transform-origin er toppen av raden, så toppen påvirkes bare av translateY.
    const base = state.element.getBoundingClientRect().top - state.offset
    const height = state.element.offsetHeight * LIFTED_SCALE
    state.offset = clientY - FINGER_GAP - height - base
    state.element.style.transform = `translateY(${state.offset}px) scale(${LIFTED_SCALE})`

    const next = findTarget(clientY, state.element)
    if (next !== targetRef.current) {
      targetRef.current = next
      setTarget(next)
    }
    frame.current = requestAnimationFrame(update)
  }

  function lift() {
    const state = press.current
    if (!state) return
    state.lifted = true
    setLifted(state.weekday)
    try {
      navigator.vibrate?.(15)
    } catch {
      // Ikke alle nettlesere tillater vibrering.
    }
    frame.current = requestAnimationFrame(update)
  }

  function finish(commit: boolean) {
    const state = press.current
    if (!state) return
    clearTimeout(state.timer)
    cancelAnimationFrame(frame.current)
    state.element.style.transform = ''
    press.current = null
    const to = targetRef.current
    targetRef.current = null
    setLifted(null)
    setTarget(null)
    window.removeEventListener('pointermove', handleMove)
    window.removeEventListener('pointerup', handleUp)
    window.removeEventListener('pointercancel', handleCancel)
    if (state.lifted) {
      // Klikket som kommer etter at man slipper skal ikke åpne oppskriften.
      window.addEventListener('click', swallowClick, true)
      window.setTimeout(() => window.removeEventListener('click', swallowClick, true), 400)
      if (commit && to !== null && to !== state.weekday) onSwapRef.current(state.weekday, to)
    }
  }

  function handleMove(e: PointerEvent) {
    const state = press.current
    if (!state) return
    state.clientY = e.clientY
    if (!state.lifted && Math.hypot(e.clientX - state.startX, e.clientY - state.startY) > MOVE_TOLERANCE) {
      // Fingeren flyttet seg før raden ble løftet: det er scrolling.
      finish(false)
    }
  }
  function handleUp() {
    finish(true)
  }
  function handleCancel() {
    finish(false)
  }
  function swallowClick(e: MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    window.removeEventListener('click', swallowClick, true)
  }

  function onPointerDown(e: ReactPointerEvent<HTMLElement>, weekday: number) {
    if (!enabled || e.button !== 0 || press.current) return
    if ((e.target as HTMLElement).closest('[data-swap-ignore]')) return
    const element = e.currentTarget
    press.current = {
      weekday,
      element,
      startX: e.clientX,
      startY: e.clientY,
      clientY: e.clientY,
      offset: 0,
      lifted: false,
      timer: window.setTimeout(lift, LIFT_DELAY),
    }
    window.addEventListener('pointermove', handleMove)
    window.addEventListener('pointerup', handleUp)
    window.addEventListener('pointercancel', handleCancel)
  }

  return { lifted, target, onPointerDown }
}
