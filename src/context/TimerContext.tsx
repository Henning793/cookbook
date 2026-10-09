import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import {
  adjustTimer,
  isRunning,
  markDue,
  parseStoredTimers,
  pauseTimer,
  resumeTimer,
  startTimer,
  timerLabel,
  type CookingTimer,
  type NewTimer,
} from '../lib/cookingTimers'
import { startAlarm, stopAlarm, unlockAlarmSound } from '../lib/alarmSound'
import { ensurePushSubscription, pushState, syncTimerToServer, type PushState } from '../lib/timerPush'

const STORAGE_KEY = 'kokeboka.timers'

interface TimerContextValue {
  timers: CookingTimer[]
  now: number
  pushState: PushState
  start: (input: Omit<NewTimer, 'id'>) => void
  pause: (id: string) => void
  resume: (id: string) => void
  adjust: (id: string, deltaMs: number) => void
  // Avbryter en klokke, eller slår av alarmen på en som ringer.
  remove: (id: string) => void
}

const TimerContext = createContext<TimerContextValue | null>(null)

function load(): CookingTimer[] {
  try {
    return parseStoredTimers(localStorage.getItem(STORAGE_KEY))
  } catch {
    return []
  }
}

function newId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

// Viser et varsel fra appen selv når den er i bakgrunnen. Push-varselet fra
// Supabase har samme tag, så det blir ett varsel selv om begge kommer.
async function notifyLocally(timer: CookingTimer) {
  if (document.visibilityState === 'visible' || pushState() !== 'granted') return
  try {
    const registration = await navigator.serviceWorker.ready
    await registration.showNotification('Tiden er ute', {
      body: `${timerLabel(timer)}${timer.recipeTitle ? ` (${timer.recipeTitle})` : ''}`,
      tag: timer.id,
      icon: '/icons/icon-192.png',
      requireInteraction: true,
      data: { url: `/oppskrift/${timer.recipeId}/kok` },
    })
  } catch {
    // Ikke kritisk: alarmen i appen ringer uansett.
  }
}

export function TimerProvider({ children }: { children: ReactNode }) {
  const [timers, setTimers] = useState<CookingTimer[]>(load)
  const [now, setNow] = useState(() => Date.now())
  const [permission, setPermission] = useState<PushState>(() => pushState())
  const timersRef = useRef(timers)

  const save = useCallback((next: CookingTimer[]) => {
    timersRef.current = next
    setTimers(next)
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
    } catch {
      // localStorage utilgjengelig: klokkene lever da bare så lenge siden er åpen.
    }
  }, [])

  const update = useCallback(
    (id: string, change: (timer: CookingTimer, now: number) => CookingTimer) => {
      const current = timersRef.current.find((t) => t.id === id)
      if (!current) return
      const changed = change(current, Date.now())
      save(timersRef.current.map((t) => (t.id === id ? changed : t)))
      setNow(Date.now())
      void syncTimerToServer(changed, id)
    },
    [save]
  )

  // Tikker så lenge en klokke går, og sjekker straks når appen blir synlig
  // igjen, så en klokke som gikk ut mens skjermen var av ringer med en gang.
  const hasRunning = timers.some(isRunning)
  useEffect(() => {
    function tick() {
      const time = Date.now()
      setNow(time)
      const { timers: next, due } = markDue(timersRef.current, time)
      if (due.length > 0) {
        save(next)
        startAlarm()
        for (const timer of due) void notifyLocally(timer)
      }
    }
    tick()
    document.addEventListener('visibilitychange', tick)
    const interval = hasRunning ? window.setInterval(tick, 500) : null
    return () => {
      document.removeEventListener('visibilitychange', tick)
      if (interval !== null) window.clearInterval(interval)
    }
  }, [hasRunning, save])

  // Alarmen stopper når ingen klokke ringer lenger.
  const anyRinging = timers.some((t) => t.ringing)
  useEffect(() => {
    if (!anyRinging) stopAlarm()
  }, [anyRinging])

  const value: TimerContextValue = {
    timers,
    now,
    pushState: permission,
    start(input) {
      unlockAlarmSound()
      const timer = startTimer({ ...input, id: newId() }, Date.now())
      save([...timersRef.current, timer])
      setNow(Date.now())
      void ensurePushSubscription().then((state) => {
        setPermission(state)
        void syncTimerToServer(timer, timer.id)
      })
    },
    pause: (id) => update(id, pauseTimer),
    resume(id) {
      unlockAlarmSound()
      update(id, resumeTimer)
    },
    adjust(id, deltaMs) {
      unlockAlarmSound()
      update(id, (timer, time) => adjustTimer(timer, deltaMs, time))
    },
    remove(id) {
      save(timersRef.current.filter((t) => t.id !== id))
      void syncTimerToServer(null, id)
    },
  }

  return <TimerContext.Provider value={value}>{children}</TimerContext.Provider>
}

export function useTimers() {
  const ctx = useContext(TimerContext)
  if (!ctx) throw new Error('useTimers must be used within TimerProvider')
  return ctx
}
