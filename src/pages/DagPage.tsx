import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { Check, ChevronLeft, Timer } from 'lucide-react'
import { useApp } from '../context/AppContext'
import { useTimers } from '../context/TimerContext'
import { Login } from '../components/Login'
import { RecipeContent } from '../components/RecipeContent'
import { useMenuDay } from '../components/useMenuDay'
import { menuDayItems, sharedServings } from '../lib/menuDishes'
import { isFromMenu } from '../lib/menuServings'
import {
  WEEKDAY_NAMES,
  dayKokemodusPath,
  dishProgress,
  dishTimerLabel,
  parseWeekdayParam,
  selectedDish,
} from '../lib/dayCooking'
import { FROM_RECIPE_STATE } from '../lib/kokemodusExit'

function formatNumber(value: number) {
  return value.toLocaleString('nb-NO')
}

// Egen side for en dag i ukesmenyen med flere oppskrifter: én fane per
// oppskrift, og kokemodus for hver av dem. Bytte fane erstatter adressen
// (?rett=) i stedet for å legge til en ny, så tilbake-sveip går rett til
// ukesmenyen.
export function DagPage() {
  const params = useParams<{ weekday: string }>()
  const weekday = parseWeekdayParam(params.weekday ?? null)
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const { session, allRecipes, cookingSession } = useApp()
  const { timers, now } = useTimers()
  const { day, loading } = useMenuDay(weekday)

  function goBack() {
    if (isFromMenu(location.state)) navigate(-1)
    else navigate('/ukesmeny')
  }

  const backButton = (
    <nav className="nav-bar">
      <button type="button" className="nav-link" onClick={goBack}>
        <ChevronLeft size={14} strokeWidth={2.75} aria-hidden="true" />
        Ukesmeny
      </button>
    </nav>
  )

  if (!session) {
    return (
      <div className="page dag-page">
        {backButton}
        <Login />
      </div>
    )
  }

  if (weekday === null || loading || !day) {
    return (
      <div className="page dag-page">
        {backButton}
        <p className="status-message">{loading ? 'Laster dagen...' : 'Fant ikke dagen i ukesmenyen.'}</p>
      </div>
    )
  }

  const items = menuDayItems(day, allRecipes)
  const dishes = items.flatMap((item) => (item.dish ? [item.dish] : []))
  const freetexts = items.filter((item) => !item.dish).map((item) => item.title)
  const shared = sharedServings(day, allRecipes)
  const selectedId = selectedDish(
    dishes.map((d) => d.recipe.id),
    searchParams.get('rett'),
    cookingSession,
    weekday
  )
  const selected = dishes.find((d) => d.recipe.id === selectedId)

  function selectTab(recipeId: string) {
    navigate({ search: `?rett=${encodeURIComponent(recipeId)}` }, { replace: true, state: location.state })
  }

  function startCooking() {
    if (!selected || weekday === null) return
    // Fanen fjernes fra adressen før kokemodus åpnes. Bytter man rett i
    // kokemodus, viser dagssiden den man sist kokte på når man kommer tilbake.
    navigate({ search: '' }, { replace: true, state: location.state })
    navigate(dayKokemodusPath(selected.recipe.id, weekday, selected.servings), { state: FROM_RECIPE_STATE })
  }

  const progress = selected ? dishProgress(cookingSession, weekday, selected.recipe.id) : null

  return (
    <div className="page dag-page">
      {backButton}
      <p className="dag-kicker">{WEEKDAY_NAMES[weekday]}</p>
      <h1 className="dag-title">{shared != null ? `Middag for ${formatNumber(shared)}` : 'Middag'}</h1>

      {dishes.length > 0 && (
        <div className="dag-tabs" role="tablist">
          {dishes.map((dish) => {
            const id = dish.recipe.id
            const tabProgress = dishProgress(cookingSession, weekday, id)
            const timerLabel = dishTimerLabel(timers, id, now)
            return (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={id === selectedId}
                className={`dag-tab${id === selectedId ? ' dag-tab-active' : ''}`}
                onClick={() => selectTab(id)}
              >
                {dish.recipe.title}
                {timerLabel ? (
                  <span className="dag-tab-status">
                    <Timer size={11} strokeWidth={2.75} aria-hidden="true" /> {timerLabel}
                  </span>
                ) : tabProgress?.kind === 'step' ? (
                  <span className="dag-tab-status">
                    Steg {tabProgress.stepIndex + 1}/{dish.recipe.steps.length}
                  </span>
                ) : tabProgress?.kind === 'done' ? (
                  <span className="dag-tab-status">
                    <Check size={11} strokeWidth={3} aria-hidden="true" /> Ferdig
                  </span>
                ) : null}
              </button>
            )
          })}
        </div>
      )}

      {freetexts.length > 0 && (
        <p className="dag-also">
          Også: <b>{freetexts.join(', ')}</b>
        </p>
      )}

      {selected ? (
        <div className="dag-recipe">
          <div className="dag-recipe-head">
            <h2 className="dag-recipe-title">{selected.recipe.title}</h2>
            <span className="dag-recipe-servings">
              {formatNumber(selected.servings)} {selected.servings === 1 ? 'porsjon' : 'porsjoner'}
            </span>
          </div>

          <button
            type="button"
            className={`cta-button${progress?.kind === 'step' ? ' dag-cta-resume' : ''}`}
            disabled={selected.recipe.steps.length === 0}
            onClick={startCooking}
          >
            {progress?.kind === 'step' ? 'Fortsett kokemodus' : 'Start kokemodus'}
          </button>

          <RecipeContent recipe={selected.recipe} scaleFactor={selected.servings / selected.base} />
        </div>
      ) : (
        <p className="status-message">Dagen har ingen oppskrifter.</p>
      )}
    </div>
  )
}
