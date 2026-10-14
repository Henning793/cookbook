import { useEffect, useState } from 'react'
import { useApp } from '../context/AppContext'
import { listMenuDays } from '../lib/menuDays'
import type { MenuDay } from '../types'

// Sist hentede dager, så kokemodus ikke blinker når man bytter rett.
const cache = new Map<string, MenuDay | undefined>()

// Én dag i ukesmenyen (familiens eller ens egen). weekday null = ingen dag.
export function useMenuDay(weekday: number | null): { day: MenuDay | undefined; loading: boolean } {
  const { session, family, familyLoading } = useApp()
  const familyId = family?.id ?? null
  const key = `${familyId ?? 'meg'}:${weekday}`
  const [day, setDay] = useState<MenuDay | undefined>(() => cache.get(key))
  const [loading, setLoading] = useState(weekday !== null && !cache.has(key))

  useEffect(() => {
    if (weekday === null || familyLoading || !session) {
      if (!familyLoading) setLoading(false)
      return
    }
    let cancelled = false
    listMenuDays(familyId)
      .then((rows) => {
        const found = rows.find((d) => d.weekday === weekday)
        cache.set(key, found)
        if (!cancelled) setDay(found)
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekday, familyId, familyLoading, session?.user.id])

  return { day, loading }
}
