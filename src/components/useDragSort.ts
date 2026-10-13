import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import type { SortPosition } from '../lib/reorder'

// Dra-og-slipp med håndtak, laget for både mus og finger (pointer events).
// Elementene merkes med data-sort-item="<kind>" og data-sort-index, og
// områdene de kan slippes i med data-sort-zone="<kind>" og data-sort-group.
// Målet regnes ut fra midtpunktet til radene, uten at raden selv telles med,
// så `to.index` er plassen etter at raden er tatt ut (se moveBetweenGroups).

const EDGE = 70
const MAX_SCROLL_SPEED = 14

interface DragState {
  from: SortPosition
  element: HTMLElement
  // Hvor i raden man tok tak, så raden følger fingeren selv om siden
  // ruller eller noe over endrer høyde mens man drar.
  grabOffset: number
  offset: number
  clientY: number
}

export function useDragSort(kind: string, onDrop: (from: SortPosition, to: SortPosition) => void) {
  const [dragging, setDragging] = useState<SortPosition | null>(null)
  const [target, setTarget] = useState<SortPosition | null>(null)
  const drag = useRef<DragState | null>(null)
  const targetRef = useRef<SortPosition | null>(null)
  const onDropRef = useRef(onDrop)
  const frame = useRef(0)

  useEffect(() => {
    onDropRef.current = onDrop
  })

  useEffect(() => () => cancelAnimationFrame(frame.current), [])

  function findTarget(clientY: number, dragged: HTMLElement): SortPosition | null {
    const zones = [...document.querySelectorAll<HTMLElement>(`[data-sort-zone="${kind}"]`)]
    if (zones.length === 0) return null
    let zone = zones.find((z) => {
      const rect = z.getBoundingClientRect()
      return clientY >= rect.top && clientY <= rect.bottom
    })
    if (!zone) {
      zone = zones.reduce((best, z) => {
        const r = z.getBoundingClientRect()
        const b = best.getBoundingClientRect()
        const dist = Math.min(Math.abs(clientY - r.top), Math.abs(clientY - r.bottom))
        const bestDist = Math.min(Math.abs(clientY - b.top), Math.abs(clientY - b.bottom))
        return dist < bestDist ? z : best
      })
    }
    const items = [...zone.querySelectorAll<HTMLElement>(`[data-sort-item="${kind}"]`)].filter((el) => el !== dragged)
    const index = items.filter((el) => {
      const rect = el.getBoundingClientRect()
      return rect.top + rect.height / 2 < clientY
    }).length
    return { group: Number(zone.dataset.sortGroup ?? 0), index }
  }

  function update() {
    const state = drag.current
    if (!state) return
    // Ruller siden når fingeren er nær kanten, så man kan dra forbi skjermen.
    const { clientY } = state
    let speed = 0
    if (clientY < EDGE) speed = -MAX_SCROLL_SPEED * (1 - Math.max(clientY, 0) / EDGE)
    else if (clientY > window.innerHeight - EDGE)
      speed = MAX_SCROLL_SPEED * (1 - Math.max(window.innerHeight - clientY, 0) / EDGE)
    if (speed !== 0) window.scrollBy(0, speed)

    const base = state.element.getBoundingClientRect().top - state.offset
    state.offset = clientY - state.grabOffset - base
    state.element.style.transform = `translateY(${state.offset}px)`

    const next = findTarget(clientY, state.element)
    const current = targetRef.current
    if (next?.group !== current?.group || next?.index !== current?.index) {
      targetRef.current = next
      setTarget(next)
    }
    frame.current = requestAnimationFrame(update)
  }

  function finish(commit: boolean) {
    const state = drag.current
    if (!state) return
    cancelAnimationFrame(frame.current)
    state.element.style.transform = ''
    drag.current = null
    const to = targetRef.current
    targetRef.current = null
    setDragging(null)
    setTarget(null)
    window.removeEventListener('pointermove', handleMove)
    window.removeEventListener('pointerup', handleUp)
    window.removeEventListener('pointercancel', handleCancel)
    if (commit && to) onDropRef.current(state.from, to)
  }

  function handleMove(e: PointerEvent) {
    if (drag.current) drag.current.clientY = e.clientY
  }
  function handleUp() {
    finish(true)
  }
  function handleCancel() {
    finish(false)
  }

  function startDrag(e: ReactPointerEvent<HTMLElement>, group: number, index: number) {
    if (e.button !== 0 || drag.current) return
    const element = e.currentTarget.closest<HTMLElement>(`[data-sort-item="${kind}"]`)
    if (!element) return
    e.preventDefault()
    ;(document.activeElement as HTMLElement | null)?.blur?.()
    const grabOffset = e.clientY - element.getBoundingClientRect().top
    drag.current = { from: { group, index }, element, grabOffset, offset: 0, clientY: e.clientY }
    setDragging({ group, index })
    window.addEventListener('pointermove', handleMove)
    window.addEventListener('pointerup', handleUp)
    window.addEventListener('pointercancel', handleCancel)
    frame.current = requestAnimationFrame(update)
  }

  return { dragging, target, startDrag }
}
