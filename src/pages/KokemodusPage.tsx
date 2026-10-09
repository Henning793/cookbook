import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { ChevronLeft, Timer } from 'lucide-react'
import { useApp } from '../context/AppContext'
import { formatScaledAmount, ingredientsForStep, stepDisplayText } from '../lib/recipeIngredients'
import { formatDuration, stepTimerSeconds } from '../lib/stepTimer'
import { useTimers } from '../context/TimerContext'
import { KokemodusBell, PushHint, TimerCard, TimerPanel, TimerPill } from '../components/CookingTimers'
import { cookingModeTimers } from '../lib/cookingTimers'
import { StepText } from '../components/StepText'

const SWIPE_THRESHOLD = 50

export function KokemodusPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { recipes, cookingSession, setCookingSession, loading } = useApp()
  const { timers, now, start: startTimer, pushState } = useTimers()

  const recipe = recipes.find((r) => r.id === id)

  // Porsjonstallet kommer fra oppskriftssiden (?porsjoner=) eller fra den
  // lagrede kokeøkten ("Fortsett" på forsiden). Ugyldig verdi = ingen skalering.
  const [searchParams] = useSearchParams()
  const [servings] = useState<number | null>(() => {
    const fromUrl = Number(searchParams.get('porsjoner'))
    if (Number.isFinite(fromUrl) && fromUrl > 0) return fromUrl
    const fromSession = cookingSession && cookingSession.recipeId === id ? cookingSession.servings : undefined
    return fromSession != null && Number.isFinite(fromSession) && fromSession > 0 ? fromSession : null
  })

  const [stepIndex, setStepIndex] = useState(() =>
    cookingSession && cookingSession.recipeId === id ? cookingSession.stepIndex : 0
  )
  const [timerPanelOpen, setTimerPanelOpen] = useState(false)
  const [wakeLockHeld, setWakeLockHeld] = useState(false)
  const wakeLockSupported = typeof navigator !== 'undefined' && 'wakeLock' in navigator
  const wakeLockRef = useRef<WakeLockSentinel | null>(null)
  const touchStartXRef = useRef<number | null>(null)

  // Wake lock: acquire on mount, release on unmount, re-acquire when the tab
  // becomes visible again (the browser force-releases wake locks when a tab
  // is hidden).
  useEffect(() => {
    if (!wakeLockSupported) return

    async function requestWakeLock() {
      try {
        const sentinel = await navigator.wakeLock.request('screen')
        wakeLockRef.current = sentinel
        setWakeLockHeld(true)
        sentinel.addEventListener('release', () => {
          wakeLockRef.current = null
          setWakeLockHeld(false)
        })
      } catch {
        // Kan avvises, f.eks. ved lavt batterinivå - da vises bare ikke
        // "Skjermen står på"-etiketten, appen skal ikke krasje.
        setWakeLockHeld(false)
      }
    }

    requestWakeLock()

    function handleVisibilityChange() {
      if (document.visibilityState === 'visible' && wakeLockRef.current === null) {
        requestWakeLock()
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      wakeLockRef.current?.release()
      wakeLockRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Persist cooking session on every step change.
  useEffect(() => {
    if (!id) return
    setCookingSession({ recipeId: id, stepIndex, ...(servings != null ? { servings } : {}) })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, stepIndex])

  if (!recipe) {
    return (
      <div className="page kokemodus-page">
        <p className="status-message">
          {loading ? 'Laster oppskrift...' : 'Fant ikke oppskriften.'}
        </p>
      </div>
    )
  }

  const steps = recipe.steps
  const totalSteps = steps.length
  const currentStep = steps[stepIndex] ?? ''
  const isFirstStep = stepIndex === 0
  const isLastStep = stepIndex === totalSteps - 1

  const neededGroups = ingredientsForStep(currentStep, recipe.ingredients)
  const scaleFactor = servings != null ? servings / (recipe.servings ?? 1) : 1

  // Nedtelling: tiden er overstyrt i skjemaet eller gjettet fra stegteksten.
  // Klokker for andre steg eller oppskrifter ligger bak bjella øverst. Er det
  // ett minutt eller mindre igjen, dukker de opp som en pille, og ringer de,
  // vises de som vanlig kort over steget.
  const stepSeconds = stepTimerSeconds(currentStep)
  const stepTimers = timers.filter((t) => t.recipeId === recipe.id && t.stepIndex === stepIndex)
  const otherTimers = timers.filter((t) => !stepTimers.includes(t))
  const { ringing: ringingOthers, soon: soonOthers, inBell } = cookingModeTimers(otherTimers, now)

  function handleStartTimer(seconds: number) {
    if (!recipe) return
    startTimer({
      recipeId: recipe.id,
      recipeTitle: recipe.title,
      stepIndex,
      stepText: stepDisplayText(currentStep, recipe.ingredients),
      durationMs: seconds * 1000,
    })
  }

  function goToStep(index: number) {
    setStepIndex(Math.max(0, Math.min(totalSteps - 1, index)))
  }

  function handleBack() {
    if (!isFirstStep) goToStep(stepIndex - 1)
  }

  function handleNext() {
    if (isLastStep) {
      setCookingSession(null)
      navigate(`/oppskrift/${id}`)
    } else {
      goToStep(stepIndex + 1)
    }
  }

  function handleTouchStart(event: React.TouchEvent) {
    touchStartXRef.current = event.changedTouches[0]?.clientX ?? null
  }

  function handleTouchEnd(event: React.TouchEvent) {
    const startX = touchStartXRef.current
    touchStartXRef.current = null
    if (startX == null) return

    const endX = event.changedTouches[0]?.clientX ?? startX
    const delta = endX - startX

    if (Math.abs(delta) < SWIPE_THRESHOLD) return

    if (delta < 0) {
      handleNext()
    } else {
      handleBack()
    }
  }

  return (
    <div className="page kokemodus-page">
      <nav className="nav-bar kokemodus-nav-bar">
        <button
          type="button"
          className="nav-link kokemodus-exit"
          onClick={() => {
            navigate(`/oppskrift/${id}`)
          }}
        >
          Avslutt
        </button>
        <div className="kokemodus-nav-right">
          {wakeLockSupported && wakeLockHeld && (
            <span className="kokemodus-wakelock-label">Skjermen står på</span>
          )}
          <KokemodusBell count={inBell.length} open={timerPanelOpen} onToggle={() => setTimerPanelOpen((o) => !o)} />
        </div>
      </nav>

      <div className="kokemodus-progress">
        {steps.map((_, index) => (
          <div
            key={index}
            className={
              'kokemodus-progress-pill' +
              (index <= stepIndex ? ' kokemodus-progress-pill-active' : '')
            }
          />
        ))}
      </div>

      {(ringingOthers.length > 0 || soonOthers.length > 0) && (
        <div className="kokemodus-timers">
          {ringingOthers.map((timer) => (
            <TimerCard key={timer.id} timer={timer} />
          ))}
          {soonOthers.length > 0 && (
            <div className="kokemodus-timer-pills">
              {soonOthers.map((timer) => (
                <TimerPill key={timer.id} timer={timer} onOpen={() => setTimerPanelOpen(true)} />
              ))}
            </div>
          )}
        </div>
      )}

      {timerPanelOpen && inBell.length > 0 && (
        <TimerPanel timers={inBell} pushState={pushState} onClose={() => setTimerPanelOpen(false)} />
      )}

      <div
        className="kokemodus-step-body"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <p className="kokemodus-step-kicker">
          Steg {stepIndex + 1} av {totalSteps}
        </p>
        <p className="kokemodus-step-text">
          <StepText text={currentStep} ingredients={recipe.ingredients} />
        </p>

        {stepTimers.length > 0 ? (
          <div className="kokemodus-step-timers">
            {stepTimers.map((timer) => (
              <TimerCard key={timer.id} timer={timer} large showLabel={false} />
            ))}
            <PushHint state={pushState} />
          </div>
        ) : (
          stepSeconds != null && (
            <button type="button" className="kokemodus-timer-start" onClick={() => handleStartTimer(stepSeconds)}>
              <Timer size={20} strokeWidth={2.5} aria-hidden="true" />
              Start {formatDuration(stepSeconds)}
            </button>
          )
        )}

        {neededGroups.length > 0 && (
          <div className="kokemodus-need-panel">
            <p className="kokemodus-need-label">Du trenger nå</p>
            {neededGroups.map((group, groupIndex) => (
              <div className="kokemodus-need-group" key={groupIndex}>
                {group.componentName && (
                  <p className="kokemodus-need-component">{group.componentName}</p>
                )}
                <ul className="kokemodus-need-list">
                  {group.items.map((item, itemIndex) => (
                    <li key={itemIndex}>
                      <span>{item.name}</span>
                      <span className="kokemodus-need-amount">{formatScaledAmount(item, scaleFactor)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="kokemodus-footer">
        <button
          type="button"
          className="kokemodus-back-button"
          disabled={isFirstStep}
          onClick={handleBack}
          aria-label="Forrige steg"
        >
          <ChevronLeft size={22} strokeWidth={2.75} aria-hidden="true" />
        </button>
        <button type="button" className="kokemodus-next-button" onClick={handleNext}>
          {isLastStep ? 'Ferdig' : 'Neste steg'}
        </button>
      </div>
    </div>
  )
}
