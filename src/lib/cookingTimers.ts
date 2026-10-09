// Klokkene i kokemodus. Ren modul (ingen supabase-/Vite-import) slik at den
// kan enhetstestes med vanlig `node --test`.
//
// En klokke som går lagrer sluttidspunktet (endsAt), ikke gjenstående tid,
// så den viser riktig også etter at skjermen har vært slukket eller appen
// lukket. En klokke på pause lagrer gjenstående tid (remainingMs).

export interface CookingTimer {
  id: string
  recipeId: string
  recipeTitle: string
  stepIndex: number
  // Kort tekst som sier hvilket steg klokka hører til, f.eks. "La hvile i 20–30 min."
  stepText: string
  durationMs: number
  endsAt: number | null
  remainingMs: number
  // Tiden er ute og alarmen er ikke slått av ennå.
  ringing: boolean
}

export interface NewTimer {
  id: string
  recipeId: string
  recipeTitle: string
  stepIndex: number
  stepText: string
  durationMs: number
}

export function startTimer(input: NewTimer, now: number): CookingTimer {
  return { ...input, endsAt: now + input.durationMs, remainingMs: input.durationMs, ringing: false }
}

export function isRunning(timer: CookingTimer): boolean {
  return timer.endsAt !== null && !timer.ringing
}

export function remainingMs(timer: CookingTimer, now: number): number {
  if (timer.ringing) return 0
  if (timer.endsAt === null) return timer.remainingMs
  return Math.max(0, timer.endsAt - now)
}

export function pauseTimer(timer: CookingTimer, now: number): CookingTimer {
  if (!isRunning(timer)) return timer
  return { ...timer, endsAt: null, remainingMs: remainingMs(timer, now) }
}

export function resumeTimer(timer: CookingTimer, now: number): CookingTimer {
  if (timer.endsAt !== null || timer.ringing) return timer
  return { ...timer, endsAt: now + timer.remainingMs }
}

// + og − justerer gjenstående tid. Går den til null, ringer klokka.
export function adjustTimer(timer: CookingTimer, deltaMs: number, now: number): CookingTimer {
  if (timer.ringing) {
    if (deltaMs <= 0) return timer
    return { ...timer, ringing: false, endsAt: now + deltaMs, remainingMs: deltaMs }
  }
  const left = Math.max(0, remainingMs(timer, now) + deltaMs)
  if (timer.endsAt === null) return { ...timer, remainingMs: left }
  return { ...timer, endsAt: now + left, remainingMs: left }
}

// Klokker som har gått ut siden sist, markert som ringende.
export function markDue(timers: CookingTimer[], now: number): { timers: CookingTimer[]; due: CookingTimer[] } {
  const due: CookingTimer[] = []
  const next = timers.map((timer) => {
    if (isRunning(timer) && timer.endsAt !== null && timer.endsAt <= now) {
      const rung = { ...timer, ringing: true, remainingMs: 0 }
      due.push(rung)
      return rung
    }
    return timer
  })
  return { timers: due.length > 0 ? next : timers, due }
}

// Navnet som vises på klokka og i varselet, så man ser hvilken som ringer.
export function timerLabel(timer: Pick<CookingTimer, 'stepIndex' | 'stepText'>): string {
  const text = timer.stepText.trim()
  const short = text.length > 48 ? text.slice(0, 47).trimEnd() + '…' : text
  return short ? `Steg ${timer.stepIndex + 1}: ${short}` : `Steg ${timer.stepIndex + 1}`
}

// Tolker det som ligger i localStorage. Ugyldige oppføringer hoppes over.
export function parseStoredTimers(raw: string | null): CookingTimer[] {
  if (!raw) return []
  try {
    const value: unknown = JSON.parse(raw)
    if (!Array.isArray(value)) return []
    return value.filter(
      (t): t is CookingTimer =>
        typeof t === 'object' &&
        t !== null &&
        typeof t.id === 'string' &&
        typeof t.recipeId === 'string' &&
        typeof t.stepIndex === 'number' &&
        typeof t.durationMs === 'number' &&
        typeof t.remainingMs === 'number' &&
        (t.endsAt === null || typeof t.endsAt === 'number')
    ).map((t) => ({
      ...t,
      recipeTitle: typeof t.recipeTitle === 'string' ? t.recipeTitle : '',
      stepText: typeof t.stepText === 'string' ? t.stepText : '',
      ringing: t.ringing === true,
    }))
  } catch {
    return []
  }
}
