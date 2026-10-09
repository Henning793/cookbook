import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, Plus, User } from 'lucide-react'
import { useApp } from '../context/AppContext'
import { UNTAGGED_TAG, UNTAGGED_LABEL } from '../lib/tags'
import { collectionIcon } from '../lib/collectionIcon'
import { listMenuDays } from '../lib/menuDays'
import {
  aggregateIngredients,
  ingredientKey,
  listCheckedItems,
  listManualItems,
  removeAlwaysHome,
} from '../lib/shoppingList'
import { listStandingItems } from '../lib/standingItems'
import { InstallBanner } from '../components/InstallApp'
import type { MenuDay } from '../types'

// Antall fargevarianter for samlingskort uten bilde (.hjem-collection-cover-N).
const COVER_TINTS = 3

function getGreeting() {
  const hour = new Date().getHours()
  if (hour < 11) return 'God morgen'
  if (hour < 17) return 'God dag'
  return 'God kveld'
}

export function HjemPage() {
  const navigate = useNavigate()
  const { session, recipes, profiles, loading, availableTags, cookingSession, family, familyLoading } = useApp()

  const [todayMenu, setTodayMenu] = useState<MenuDay | null>(null)
  const [shoppingItemsLeft, setShoppingItemsLeft] = useState(0)

  useEffect(() => {
    if (familyLoading || !session) return
    const familyId = family?.id ?? null
    const isoWeekday = (new Date().getDay() + 6) % 7 // JS: 0=søn -> her: 0=man ... 6=søn

    Promise.all([
      listMenuDays(familyId),
      listCheckedItems(familyId),
      listManualItems(familyId),
      listStandingItems(familyId, 'always_home'),
    ]).then(
      ([days, checkedRows, manualItems, alwaysHome]) => {
        setTodayMenu(days.find((d) => d.weekday === isoWeekday && d.entry_type) ?? null)
        const aggregated = removeAlwaysHome(
          aggregateIngredients(days, recipes),
          new Set(alwaysHome.map((i) => i.normalized_name))
        )
        const checkedKeys = new Set(checkedRows.map((c) => ingredientKey(c.normalized_name, c.unit)))
        const uncheckedCount = aggregated.filter(
          (item) => !checkedKeys.has(ingredientKey(item.normalizedName, item.unit))
        ).length
        setShoppingItemsLeft(uncheckedCount + manualItems.filter((m) => !m.checked).length)
      }
    )
  }, [family, familyLoading, session, recipes])

  const name = session
    ? profiles.find((p) => p.id === session.user.id)?.display_name ?? null
    : null

  // Samme utledning som RecipeList.tsx sin tagsWithRecipes: tags fra
  // availableTags som faktisk brukes av minst én oppskrift.
  const tagsWithRecipes = useMemo(() => {
    const usedTags = new Set(recipes.flatMap((recipe) => recipe.tags))
    return availableTags.filter((tag) => usedTags.has(tag))
  }, [recipes, availableTags])

  const collections = useMemo(() => {
    // Kortet viser bilder fra opptil tre oppskrifter i samlingen.
    const summarize = (tag: string, label: string, inCollection: typeof recipes) => ({
      tag,
      label,
      count: inCollection.length,
      coverUrls: inCollection.flatMap((recipe) => (recipe.image_url ? [recipe.image_url] : [])).slice(0, 3),
    })
    const tagged = tagsWithRecipes.map((tag) =>
      summarize(tag, tag, recipes.filter((recipe) => recipe.tags.includes(tag)))
    )
    const untagged = recipes.filter((recipe) => recipe.tags.length === 0)
    return untagged.length > 0
      ? [...tagged, summarize(UNTAGGED_TAG, UNTAGGED_LABEL, untagged)]
      : tagged
  }, [tagsWithRecipes, recipes])

  const cookingRecipe = cookingSession
    ? recipes.find((recipe) => recipe.id === cookingSession.recipeId)
    : null

  const initialSource = name ?? session?.user.email ?? ''
  const initial = initialSource.charAt(0).toUpperCase()

  return (
    <div className="page hjem-page">
      <div className="hjem-header">
        <div>
          {session && (
            <p className="hjem-kicker">
              {getGreeting()}
              {name ? `, ${name}` : ''}
            </p>
          )}
          <h1 className="hjem-title">Kokeboka</h1>
        </div>
        <button
          type="button"
          className="hjem-avatar"
          aria-label="Profil"
          onClick={() => navigate('/meg')}
        >
          {session ? initial : <User size={16} strokeWidth={2.75} aria-hidden="true" />}
        </button>
      </div>

      <InstallBanner />

      <div className="search-field" onClick={() => navigate('/sok')}>
        <Search size={15} strokeWidth={2.5} aria-hidden="true" />
        <input
          readOnly
          type="text"
          placeholder={`Søk i ${recipes.length} oppskrifter`}
          onFocus={() => navigate('/sok')}
        />
      </div>

      {session && (
        <div className="hjem-menu-row">
          <button type="button" className="hjem-menu-card" onClick={() => navigate('/ukesmeny')}>
            <span className="hjem-menu-card-label">Ukesmeny</span>
            <span className="hjem-menu-card-value">
              {todayMenu
                ? `i kveld: ${
                    todayMenu.entry_type === 'freetext'
                      ? todayMenu.freetext
                      : recipes.find((r) => r.id === todayMenu.recipe_id)?.title ?? 'Slettet oppskrift'
                  }`
                : 'Ingen plan for i dag'}
            </span>
          </button>
          <button type="button" className="hjem-menu-card" onClick={() => navigate('/handleliste')}>
            <span className="hjem-menu-card-label">Handleliste</span>
            <span className="hjem-menu-card-value">{shoppingItemsLeft} varer igjen</span>
          </button>
        </div>
      )}

      {cookingSession && cookingRecipe && (
        <div className="hjem-sist-brukt">
          <div className="hjem-sist-brukt-text">
            <p className="hjem-sist-brukt-kicker">Sist brukt</p>
            <h2 className="hjem-sist-brukt-title">{cookingRecipe.title}</h2>
            <p className="hjem-sist-brukt-meta">Du stoppet på steg {cookingSession.stepIndex + 1}</p>
          </div>
          <button
            type="button"
            className="hjem-sist-brukt-cta"
            onClick={() => navigate(`/oppskrift/${cookingSession.recipeId}/kok`)}
          >
            Fortsett
          </button>
        </div>
      )}

      {loading ? (
        <p className="status-message">Laster oppskrifter...</p>
      ) : recipes.length === 0 ? (
        <p className="status-message">Ingen oppskrifter enda. Legg til den første!</p>
      ) : (
        <>
          <div className="hjem-section-head">
            <h2>Samlinger</h2>
            <button type="button" className="hjem-section-link" onClick={() => navigate('/samlinger')}>
              Mine samlinger
            </button>
          </div>
          <div className="hjem-grid">
            {collections.map(({ tag, label, count, coverUrls }, index) => {
              const Icon = collectionIcon(label)
              return (
                <button
                  type="button"
                  key={tag}
                  className="hjem-collection-card"
                  onClick={() => navigate(`/samling/${encodeURIComponent(tag)}`)}
                >
                  {coverUrls.length > 0 ? (
                    <span
                      className={`hjem-collection-cover hjem-collection-mosaic-${coverUrls.length}`}
                      aria-hidden="true"
                    >
                      {coverUrls.map((url) => (
                        <img key={url} src={url} alt="" loading="lazy" />
                      ))}
                    </span>
                  ) : (
                    <span
                      className={`hjem-collection-cover hjem-collection-cover-${index % COVER_TINTS}`}
                      aria-hidden="true"
                    >
                      <Icon size={60} strokeWidth={1.3} />
                    </span>
                  )}
                  <span className="hjem-collection-body">
                    <span className="hjem-collection-name">{label}</span>
                    <span className="hjem-collection-count">
                      {count} {count === 1 ? 'oppskrift' : 'oppskrifter'}
                    </span>
                  </span>
                </button>
              )
            })}
          </div>
        </>
      )}

      {session && (
        <button
          type="button"
          className="hjem-fab"
          aria-label="Ny oppskrift"
          onClick={() => navigate('/ny')}
        >
          <Plus size={30} strokeWidth={2.75} aria-hidden="true" />
        </button>
      )}
    </div>
  )
}
