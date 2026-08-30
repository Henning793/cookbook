import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useApp } from '../context/AppContext'

const SWIPE_THRESHOLD = 50

export function KokemodusPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { recipes, cookingSession, setCookingSession, loading } = useApp()

  const recipe = recipes.find((r) => r.id === id)

  const [stepIndex, setStepIndex] = useState(() =>
    cookingSession && cookingSession.recipeId === id ? cookingSession.stepIndex : 0
  )
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
    setCookingSession({ recipeId: id, stepIndex })
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

  const neededIngredients = recipe.ingredients
    .filter((i) => !i.isHeading)
    .filter((i) => currentStep.toLowerCase().includes(i.name.toLowerCase()))
    .map((i) => i.name)

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
        {wakeLockSupported && wakeLockHeld && (
          <span className="kokemodus-wakelock-label">Skjermen står på</span>
        )}
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

      <div
        className="kokemodus-step-body"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <p className="kokemodus-step-kicker">
          Steg {stepIndex + 1} av {totalSteps}
        </p>
        <p className="kokemodus-step-text">{currentStep}</p>

        {neededIngredients.length > 0 && (
          <div className="kokemodus-need-panel">
            <p className="kokemodus-need-label">Du trenger nå</p>
            <p className="kokemodus-need-contents">{neededIngredients.join(' · ')}</p>
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
          ‹
        </button>
        <button type="button" className="kokemodus-next-button" onClick={handleNext}>
          {isLastStep ? 'Ferdig' : 'Neste steg'}
        </button>
      </div>
    </div>
  )
}
