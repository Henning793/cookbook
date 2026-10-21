import { useEffect, useLayoutEffect, useRef } from 'react'
import { useLocation, useNavigationType } from 'react-router-dom'
import { scrollAction } from '../lib/scrollPosition'

// Scrollposisjon per historikkoppføring (location.key), så tilbake-knappen
// kan legge listen der den var.
const positions = new Map<string, number>()

// Hvor lenge vi prøver å gjenopprette en posisjon mens innholdet lastes inn.
const RESTORE_TIMEOUT_MS = 1500

export function ScrollManager() {
  const location = useLocation()
  const navigationType = useNavigationType()
  const prevPath = useRef<string | null>(null)

  // Nettleseren skal ikke gjette selv: den gjenoppretter før innholdet er
  // tegnet og kjemper mot oss.
  useEffect(() => {
    if ('scrollRestoration' in history) history.scrollRestoration = 'manual'
  }, [])

  // Husk posisjonen for oppføringen som vises nå. Nøkkelen leses først når
  // rammen kjører, så scrollhendelser fra selve sidebyttet ikke skriver over
  // posisjonen til siden vi forlot.
  const currentKey = useRef(location.key)
  useEffect(() => {
    let frame = 0
    const onScroll = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => positions.set(currentKey.current, window.scrollY))
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('scroll', onScroll)
    }
  }, [])

  // Før skjermen tegnes, så den nye siden ikke blinker nede i innholdet.
  useLayoutEffect(() => {
    const action = scrollAction(navigationType, prevPath.current, location.pathname, positions.get(location.key))
    prevPath.current = location.pathname
    currentKey.current = location.key
    if (action.kind === 'keep') return
    if (action.kind === 'top') {
      window.scrollTo(0, 0)
      return
    }
    // Innhold som ikke er i hurtigbufferen kommer etter første tegning, så
    // siden er kanskje ikke høy nok ennå. Prøv igjen til posisjonen nås,
    // tiden går ut eller brukeren tar over.
    const target = action.y
    const started = performance.now()
    let frame = 0
    const stop = () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('touchstart', stop)
      window.removeEventListener('wheel', stop)
    }
    const attempt = () => {
      window.scrollTo(0, target)
      if (Math.abs(window.scrollY - target) < 2 || performance.now() - started > RESTORE_TIMEOUT_MS) {
        stop()
        return
      }
      frame = requestAnimationFrame(attempt)
    }
    window.addEventListener('touchstart', stop, { passive: true })
    window.addEventListener('wheel', stop, { passive: true })
    attempt()
    return stop
  }, [location.key, location.pathname, navigationType])

  return null
}
