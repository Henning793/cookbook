import { useEffect, useState } from 'react'
import { ChevronLeft, Timer, X } from 'lucide-react'
import { useApp } from '../context/AppContext'
import { useTimers } from '../context/TimerContext'
import { PushHint, TimerCard } from './CookingTimers'
import { descriptionParts } from '../lib/descriptionLinks'
import { formatScaledAmount, ingredientsForStep, stepDisplayText } from '../lib/recipeIngredients'
import { formatDuration, stepTimerSeconds } from '../lib/stepTimer'
import { techniqueTimerText } from '../lib/techniqueCooking'
import type { IngredientItem, Recipe } from '../types'

// En teknikk åpnet fra et steg i kokemodus. Panelet åpner alltid på
// oversikten (beskrivelse, det du trenger og alle stegene), slik at man kan
// lese over og lukke. «Kokemodus» går over til steg for steg i samme panel.
// Oppskriften under blir stående på steget sitt hele tiden.
export function TechniquePanel({
  technique,
  recipe,
  recipeStepIndex,
  scaleFactor,
  savedStep,
  onStepChange,
  onClose,
  timerExtras,
}: {
  technique: Recipe
  // Oppskriften og steget teknikken ble åpnet fra.
  recipe: Recipe
  recipeStepIndex: number
  scaleFactor: number
  // Steget man stoppet på i teknikken, eller null når den ikke er startet.
  savedStep: number | null
  onStepChange: (step: number | null) => void
  onClose: () => void
  // Ukedag og porsjoner, så varselet åpner riktig kokemodus.
  timerExtras: { weekday?: number; servings?: number }
}) {
  const { allRecipes, techniques } = useApp()
  const { timers, start: startTimer, pushState } = useTimers()
  const [mode, setMode] = useState<'overview' | 'steps'>('overview')
  const step = savedStep ?? 0

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  const steps = technique.steps
  const totalSteps = steps.length
  const isLastStep = step === totalSteps - 1
  const meta = [
    `${totalSteps} steg`,
    technique.total_minutes ? `ca. ${technique.total_minutes} min` : null,
  ].filter(Boolean)

  const description = technique.description
    ? descriptionParts(technique.description, allRecipes, technique.id)
        .map((part) => part.text)
        .join('')
    : null

  const displayStep = (text: string) => stepDisplayText(text, technique.ingredients, techniques)

  function startCooking() {
    if (savedStep === null) onStepChange(0)
    setMode('steps')
  }

  function goToStep(index: number) {
    onStepChange(Math.max(0, Math.min(totalSteps - 1, index)))
  }

  function handleBack() {
    if (step === 0) setMode('overview')
    else goToStep(step - 1)
  }

  function handleNext() {
    if (isLastStep) {
      onStepChange(null)
      onClose()
    } else {
      goToStep(step + 1)
    }
  }

  const renderIngredient = (item: IngredientItem, index: number) => (
    <li key={index} className="technique-panel-ingredient">
      <span>{item.name}</span>
      <span className="technique-panel-amount">{formatScaledAmount(item, scaleFactor)}</span>
    </li>
  )

  const hasIngredients = technique.ingredients.loose.length > 0 || technique.ingredients.components.length > 0

  // Steg for steg
  const currentStep = steps[step] ?? ''
  const timerText = techniqueTimerText(technique.title, displayStep(currentStep))
  const stepSeconds = stepTimerSeconds(currentStep)
  const stepTimers = timers.filter(
    (t) => t.recipeId === recipe.id && t.stepIndex === recipeStepIndex && t.stepText === timerText
  )
  const neededGroups = ingredientsForStep(currentStep, technique.ingredients, techniques)

  function handleStartTimer(seconds: number) {
    startTimer({
      recipeId: recipe.id,
      recipeTitle: recipe.title,
      stepIndex: recipeStepIndex,
      stepText: timerText,
      ...timerExtras,
      durationMs: seconds * 1000,
    })
  }

  return (
    <div className="technique-panel-backdrop" onClick={onClose}>
      <div
        className="technique-panel"
        role="dialog"
        aria-label={technique.title}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="technique-panel-header">
          <div>
            <p className="technique-panel-kicker">Teknikk</p>
            <h2 className="technique-panel-title">{technique.title}</h2>
            {mode === 'overview' && <p className="technique-panel-meta">{meta.join(' · ')}</p>}
          </div>
          <button type="button" className="technique-panel-close" onClick={onClose} aria-label="Lukk">
            <X size={18} strokeWidth={2.5} aria-hidden="true" />
          </button>
        </div>

        {mode === 'overview' ? (
          <>
            <div className="technique-panel-body">
              {description && <p className="technique-panel-description">{description}</p>}
              {hasIngredients && (
                <>
                  <p className="technique-panel-section">Du trenger</p>
                  {technique.ingredients.loose.length > 0 && (
                    <ul className="technique-panel-ingredients">{technique.ingredients.loose.map(renderIngredient)}</ul>
                  )}
                  {technique.ingredients.components.map((component, componentIndex) => (
                    <div key={componentIndex}>
                      <p className="technique-panel-component">{component.name}</p>
                      <ul className="technique-panel-ingredients">{component.ingredients.map(renderIngredient)}</ul>
                    </div>
                  ))}
                </>
              )}
              <p className="technique-panel-section">Slik gjør du</p>
              <ol className="technique-panel-steps">
                {steps.map((text, index) => (
                  <li
                    key={index}
                    className={
                      'technique-panel-step' +
                      (savedStep !== null && index < savedStep ? ' technique-panel-step-done' : '') +
                      (savedStep === index ? ' technique-panel-step-current' : '')
                    }
                  >
                    <span className="technique-panel-step-number">{index + 1}</span>
                    <span>{displayStep(text)}</span>
                  </li>
                ))}
              </ol>
            </div>
            <div className="technique-panel-footer">
              <button type="button" className="technique-panel-secondary" onClick={onClose}>
                Lukk
              </button>
              {totalSteps > 0 && (
                <button type="button" className="technique-panel-primary" onClick={startCooking}>
                  {savedStep === null ? 'Kokemodus' : `Fortsett steg ${savedStep + 1}`}
                </button>
              )}
            </div>
          </>
        ) : (
          <>
            <div className="kokemodus-progress technique-panel-progress">
              {steps.map((_, index) => (
                <div
                  key={index}
                  className={'kokemodus-progress-pill' + (index <= step ? ' kokemodus-progress-pill-active' : '')}
                />
              ))}
            </div>
            <div className="technique-panel-body">
              <p className="kokemodus-step-kicker">
                Steg {step + 1} av {totalSteps}
              </p>
              <p className="technique-panel-step-text">{displayStep(currentStep)}</p>

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
                <div className="kokemodus-need-panel technique-panel-need">
                  <p className="kokemodus-need-label">Du trenger nå</p>
                  {neededGroups.map((group, groupIndex) => (
                    <div className="kokemodus-need-group" key={groupIndex}>
                      {group.componentName && <p className="kokemodus-need-component">{group.componentName}</p>}
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
            <div className="kokemodus-footer technique-panel-footer">
              <button
                type="button"
                className="kokemodus-back-button"
                onClick={handleBack}
                aria-label={step === 0 ? 'Tilbake til oversikten' : 'Forrige steg'}
              >
                <ChevronLeft size={22} strokeWidth={2.75} aria-hidden="true" />
              </button>
              <button type="button" className="kokemodus-next-button technique-panel-next" onClick={handleNext}>
                {isLastStep ? `Ferdig – tilbake til ${recipe.title}` : 'Neste steg'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
