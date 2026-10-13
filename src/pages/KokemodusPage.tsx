import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { Check, ChevronLeft, Timer } from 'lucide-react'
import { useApp } from '../context/AppContext'
import { formatScaledAmount, ingredientsForStep, stepDisplayText } from '../lib/recipeIngredients'
import { formatDuration, stepTimerSeconds } from '../lib/stepTimer'
import { useTimers } from '../context/TimerContext'
import { KokemodusBell, PushHint, TimerCard, TimerPanel, TimerPill } from '../components/CookingTimers'
import { cookingModeTimers } from '../lib/cookingTimers'
import { StepText } from '../components/StepText'
import { kokemodusExit } from '../lib/kokemodusExit'
import {
  WEEKDAY_NAMES,
  dayKokemodusPath,
  dayStartStep,
  dishProgress,
  dishTimerLabel,
  finishDayDish,
  parseWeekdayParam,
  withDayStep,
} from '../lib/dayCooking'
import { plannedDishes } from '../lib/menuDishes'
import { useMenuDay } from '../components/useMenuDay'

// Kokeøkten er per bruker, så steget man stoppet på kan først leses når
// innloggingen er lest.
export function KokemodusPage() {
  const { sessionLoading } = useApp()
  const { id } = useParams<{ id: string }>()
  if (sessionLoading) return null
  // Ny rett (bytte rett fra dagen) = ny kokemodus med sitt eget steg.
  return <Kokemodus key={id} />
}

function Kokemodus() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const location = useLocation()
  const { allRecipes, cookingSession, setCookingSession, loading } = useApp()
  const { timers, now, start: startTimer, pushState } = useTimers()

  const recipe = allRecipes.find((r) => r.id === id)

  // Porsjonstallet kommer fra oppskriftssiden (?porsjoner=) eller fra den
  // lagrede kokeøkten ("Fortsett" på forsiden). Ugyldig verdi = ingen skalering.
  const [searchParams] = useSearchParams()
  // Satt når man koker fra en dag i ukesmenyen med flere oppskrifter.
  const weekday = parseWeekdayParam(searchParams.get('dag'))
  const { day } = useMenuDay(weekday)
  const [servings] = useState<number | null>(() => {
    const fromUrl = Number(searchParams.get('porsjoner'))
    if (Number.isFinite(fromUrl) && fromUrl > 0) return fromUrl
    const fromSession = cookingSession && cookingSession.recipeId === id ? cookingSession.servings : undefined
    return fromSession != null && Number.isFinite(fromSession) && fromSession > 0 ? fromSession : null
  })

  const [stepIndex, setStepIndex] = useState(() => {
    if (weekday !== null && id) return dayStartStep(cookingSession, weekday, id)
    return cookingSession && cookingSession.recipeId === id ? cookingSession.stepIndex : 0
  })
  const [timerPanelOpen, setTimerPanelOpen] = useState(false)
  const [wakeLockHeld, setWakeLockHeld] = useState(false)
  const wakeLockSupported = typeof navigator !== 'undefined' && 'wakeLock' in navigator
  const wakeLockRef = useRef<WakeLockSentinel | null>(null)

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
    if (weekday !== null) setCookingSession(withDayStep(cookingSession, weekday, id, stepIndex, servings))
    else setCookingSession({ recipeId: id, stepIndex, ...(servings != null ? { servings } : {}) })
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

  // Tilbake til oppskriften uten at kokemodus blir liggende i historikken.
  function exitToRecipe() {
    const exit = kokemodusExit(id, location.state, weekday)
    if (exit.back) navigate(-1)
    else navigate(exit.to, { replace: true })
  }

  function handleNext() {
    if (isLastStep) {
      setCookingSession(weekday !== null && id ? finishDayDish(cookingSession, weekday, id) : null)
      exitToRecipe()
    } else {
      goToStep(stepIndex + 1)
    }
  }

  // Rettene på dagen, når man koker fra en dag med flere oppskrifter. Bytte
  // rett erstatter adressen, så tilbake går til dagssiden og ikke gjennom
  // alle rettene.
  const dayDishes = weekday !== null && day ? plannedDishes(day, allRecipes) : []
  function switchDish(recipeId: string, dishServings: number) {
    if (weekday === null || recipeId === id) return
    navigate(dayKokemodusPath(recipeId, weekday, dishServings), { replace: true, state: location.state })
  }

  return (
    <div className="page kokemodus-page">
      <nav className="nav-bar kokemodus-nav-bar">
        <button
          type="button"
          className="nav-link kokemodus-exit"
          onClick={exitToRecipe}
        >
          {weekday !== null ? (
            <>
              <ChevronLeft size={14} strokeWidth={2.75} aria-hidden="true" />
              {WEEKDAY_NAMES[weekday]}
            </>
          ) : (
            'Avslutt'
          )}
        </button>
        <div className="kokemodus-nav-right">
          {wakeLockSupported && wakeLockHeld && (
            <span className="kokemodus-wakelock-label">Skjermen står på</span>
          )}
          <KokemodusBell count={inBell.length} open={timerPanelOpen} onToggle={() => setTimerPanelOpen((o) => !o)} />
        </div>
      </nav>

      {dayDishes.length > 1 && weekday !== null && (
        <div className="kokemodus-dishes">
          {dayDishes.map((dish) => {
            const dishId = dish.recipe.id
            const isCurrent = dishId === id
            const progress = dishProgress(cookingSession, weekday, dishId)
            const timerLabel = dishTimerLabel(timers, dishId, now)
            return (
              <button
                key={dishId}
                type="button"
                className={`kokemodus-dish${isCurrent ? ' kokemodus-dish-active' : ''}`}
                aria-current={isCurrent ? 'true' : undefined}
                onClick={() => switchDish(dishId, dish.servings)}
              >
                <span className="kokemodus-dish-title">{dish.recipe.title}</span>
                <span className={`kokemodus-dish-status${timerLabel && !isCurrent ? ' kokemodus-dish-timer' : ''}`}>
                  {isCurrent ? (
                    `Steg ${stepIndex + 1} av ${totalSteps}`
                  ) : timerLabel ? (
                    <>
                      <Timer size={11} strokeWidth={2.75} aria-hidden="true" /> {timerLabel}
                    </>
                  ) : progress?.kind === 'step' ? (
                    `Steg ${progress.stepIndex + 1} av ${dish.recipe.steps.length}`
                  ) : progress?.kind === 'done' ? (
                    <>
                      <Check size={11} strokeWidth={3} aria-hidden="true" /> Ferdig
                    </>
                  ) : (
                    'Ikke startet'
                  )}
                </span>
              </button>
            )
          })}
        </div>
      )}

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

      <div className="kokemodus-step-body">
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
