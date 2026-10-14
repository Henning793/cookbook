import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CalendarDays, ChefHat, ChevronRight, CookingPot, Search, type LucideIcon } from 'lucide-react'
import { useApp } from '../context/AppContext'
import { UNTAGGED_TAG, UNTAGGED_LABEL } from '../lib/tags'
import { collectionIcon } from '../lib/collectionIcon'
import { listMenuDays } from '../lib/menuDays'
import { isRecentCookingSession } from '../lib/cookingSession'
import { otherCooking, tonightCard, type CookingProgress } from '../lib/tonightCard'
import { InstallBanner } from '../components/InstallApp'
import { Welcome } from '../components/Welcome'
import { isWelcomeSeen, markNewsSeen, markWelcomeSeen, unseenNews } from '../lib/welcome'
import type { MenuDay } from '../types'

// Antall fargevarianter for samlingskort uten bilde (.hjem-collection-cover-N).
const COVER_TINTS = 3

// Oppskriften åpnet herfra får «Kokeboka» som tilbakeknapp, og tilbake går
// ett steg i historikken i stedet for å legge forsiden på nytt (samme
// mekanisme som lenker mellom oppskrifter, se OppskriftPage).
const BACK_TO_HOME = { linkedFrom: 'Kokeboka' }

function getGreeting() {
  const hour = new Date().getHours()
  if (hour < 11) return 'God morgen'
  if (hour < 17) return 'God dag'
  return 'God kveld'
}

export function HjemPage() {
  const navigate = useNavigate()
  const { session, recipes, techniques, allRecipes, profiles, loading, availableTags, cookingSession, family, familyLoading } =
    useApp()

  // undefined til ukesmenyen er lest, så kortet ikke blinker «Ingen plan».
  const [todayMenu, setTodayMenu] = useState<MenuDay | null | undefined>(undefined)
  const [welcomeSeen, setWelcomeSeen] = useState(() => isWelcomeSeen(localStorage))
  // Har man sett velkomsten før, vises bare sidene som er nye siden sist.
  const [news, setNews] = useState(() => unseenNews(localStorage))
  const isoWeekday = (new Date().getDay() + 6) % 7 // JS: 0=søn -> her: 0=man ... 6=søn

  useEffect(() => {
    if (familyLoading || !session) return
    listMenuDays(family?.id ?? null).then(
      (days) => setTodayMenu(days.find((d) => d.weekday === isoWeekday && d.entry_type) ?? null),
      () => setTodayMenu(null)
    )
  }, [family, familyLoading, session, isoWeekday])

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

  // En kokeøkt som er eldre enn et halvt døgn vises ikke lenger.
  const [now] = useState(() => Date.now())
  const recentCooking = isRecentCookingSession(cookingSession, now) ? cookingSession : null
  const tonight = todayMenu === undefined ? null : tonightCard(todayMenu, isoWeekday, allRecipes, recentCooking)
  const other = tonight ? otherCooking(tonight, recentCooking, allRecipes) : null

  const techniqueCovers = techniques
    .flatMap((recipe) => (recipe.image_url ? [recipe.image_url] : []))
    .slice(0, 3)

  return (
    <div className="page hjem-page">
      <div className="hjem-header">
        {session && (
          <p className="hjem-kicker">
            {getGreeting()}
            {name ? `, ${name}` : ''}
          </p>
        )}
        <h1 className="hjem-title">Kokeboka</h1>
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

      {session && tonight && (
        <div className="hjem-tonight-list">
          {tonight.kind === 'empty' ? (
            <button type="button" className="hjem-tonight hjem-tonight-empty" onClick={() => navigate('/ukesmeny')}>
              <span className="hjem-tonight-main">
                <span className="hjem-tonight-text">
                  <span className="hjem-tonight-label">I kveld</span>
                  <span className="hjem-tonight-title">Ingen plan ennå</span>
                  <span className="hjem-tonight-meta">Planlegg uka</span>
                </span>
                <ChevronRight className="hjem-tonight-chevron" size={22} aria-hidden="true" />
              </span>
            </button>
          ) : tonight.kind === 'freetext' ? (
            <button type="button" className="hjem-tonight" onClick={() => navigate('/ukesmeny')}>
              <span className="hjem-tonight-main">
                <span className="hjem-tonight-thumb hjem-tonight-thumb-icon" aria-hidden="true">
                  <CalendarDays size={26} strokeWidth={1.5} />
                </span>
                <span className="hjem-tonight-text">
                  <span className="hjem-tonight-label">I kveld</span>
                  <span className="hjem-tonight-title">{tonight.title}</span>
                </span>
                <ChevronRight className="hjem-tonight-chevron" size={22} aria-hidden="true" />
              </span>
            </button>
          ) : (
            <TonightRecipeCard
              label="I kveld"
              title={tonight.title}
              imageUrls={tonight.imageUrls}
              meta={
                tonight.kind === 'day'
                  ? `${tonight.dishCount} retter`
                  : tonight.servings != null
                    ? `${tonight.servings.toLocaleString('nb-NO')} ${tonight.servings === 1 ? 'porsjon' : 'porsjoner'}`
                    : null
              }
              progress={tonight.progress}
              onOpen={() =>
                tonight.kind === 'day'
                  ? navigate(tonight.openPath)
                  : navigate(tonight.openPath, { state: BACK_TO_HOME })
              }
              onResume={(path) => navigate(path)}
            />
          )}
          {other && (
            <TonightRecipeCard
              label="Sist brukt"
              title={other.recipe.title}
              imageUrls={other.recipe.image_url ? [other.recipe.image_url] : []}
              meta={null}
              progress={other}
              onOpen={() => navigate(`/oppskrift/${other.recipe.id}`, { state: BACK_TO_HOME })}
              onResume={(path) => navigate(path)}
            />
          )}
        </div>
      )}

      {loading ? (
        <p className="status-message">Laster oppskrifter...</p>
      ) : recipes.length === 0 && techniques.length === 0 ? (
        <p className="status-message">
          Kokeboka di er tom. Trykk på + for å legge inn en oppskrift.
          <br />
          <button type="button" className="nav-link hjem-tips-link" onClick={() => navigate('/tips')}>
            Se tips og triks
          </button>
        </p>
      ) : (
        <>
          <div className="hjem-section-head">
            <h2>Samlinger</h2>
          </div>
          <div className="hjem-grid">
            {collections.map(({ tag, label, count, coverUrls }, index) => (
              <CollectionCard
                key={tag}
                label={label}
                countText={`${count} ${count === 1 ? 'oppskrift' : 'oppskrifter'}`}
                coverUrls={coverUrls}
                tint={index % COVER_TINTS}
                Icon={collectionIcon(label)}
                onClick={() => navigate(`/samling/${encodeURIComponent(tag)}`)}
              />
            ))}
            {techniques.length > 0 && (
              <CollectionCard
                label="Teknikker"
                countText={`${techniques.length} ${techniques.length === 1 ? 'teknikk' : 'teknikker'}`}
                coverUrls={techniqueCovers}
                tint={collections.length % COVER_TINTS}
                Icon={ChefHat}
                onClick={() => navigate('/teknikker')}
              />
            )}
          </div>
        </>
      )}

      {/* Venter på gruppen, så en som kom inn via invitasjonslenke får gruppens navn i velkomsten. */}
      {session && !welcomeSeen && !familyLoading && (
        <Welcome
          groupName={family?.name ?? null}
          onDone={(addRecipe) => {
            markWelcomeSeen(localStorage)
            setWelcomeSeen(true)
            if (addRecipe) navigate('/ny')
          }}
        />
      )}
      {session && welcomeSeen && news.length > 0 && (
        <Welcome
          groupName={family?.name ?? null}
          news={news}
          onDone={() => {
            markNewsSeen(localStorage, news)
            setNews([])
          }}
        />
      )}
    </div>
  )
}

interface TonightRecipeCardProps {
  label: string
  title: string
  imageUrls: string[]
  meta: string | null
  progress: CookingProgress | null
  onOpen: () => void
  onResume: (path: string) => void
}

// Kortet åpner oppskriften (eller dagssiden). Er man i gang i kokemodus, får
// det i tillegg en «Fortsett»-knapp som går rett til steget.
function TonightRecipeCard({ label, title, imageUrls, meta, progress, onOpen, onResume }: TonightRecipeCardProps) {
  const stepText =
    progress && progress.totalSteps > 0
      ? `Steg ${Math.min(progress.stepIndex + 1, progress.totalSteps)} av ${progress.totalSteps}`
      : null
  // Med flere retter står navnet på retten man er i gang med foran steget.
  const progressText = stepText && progress && progress.recipe.title !== title ? `${progress.recipe.title} · ${stepText}` : stepText
  return (
    <div className="hjem-tonight">
      <button type="button" className="hjem-tonight-main" onClick={onOpen}>
        {imageUrls.length >= 2 ? (
          <span className="hjem-tonight-stack" aria-hidden="true">
            <img src={imageUrls[0]} alt="" />
            <img src={imageUrls[1]} alt="" />
          </span>
        ) : imageUrls.length === 1 ? (
          <img className="hjem-tonight-thumb" src={imageUrls[0]} alt="" />
        ) : (
          <span className="hjem-tonight-thumb hjem-tonight-thumb-icon" aria-hidden="true">
            <CookingPot size={26} strokeWidth={1.5} />
          </span>
        )}
        <span className="hjem-tonight-text">
          <span className="hjem-tonight-label">{label}</span>
          <span className="hjem-tonight-title">{title}</span>
          {(progressText ?? meta) && <span className="hjem-tonight-meta">{progressText ?? meta}</span>}
        </span>
        {!progress && <ChevronRight className="hjem-tonight-chevron" size={22} aria-hidden="true" />}
      </button>
      {progress && (
        <button type="button" className="hjem-tonight-cta" onClick={() => onResume(progress.resumePath)}>
          Fortsett
        </button>
      )}
    </div>
  )
}

interface CollectionCardProps {
  label: string
  countText: string
  coverUrls: string[]
  tint: number
  Icon: LucideIcon
  onClick: () => void
}

function CollectionCard({ label, countText, coverUrls, tint, Icon, onClick }: CollectionCardProps) {
  return (
    <button type="button" className="hjem-collection-card" onClick={onClick}>
      {coverUrls.length > 0 ? (
        <span className={`hjem-collection-cover hjem-collection-mosaic-${coverUrls.length}`} aria-hidden="true">
          {coverUrls.map((url) => (
            <img key={url} src={url} alt="" loading="lazy" />
          ))}
        </span>
      ) : (
        <span className={`hjem-collection-cover hjem-collection-cover-${tint}`} aria-hidden="true">
          <Icon size={60} strokeWidth={1.3} />
        </span>
      )}
      <span className="hjem-collection-body">
        <span className="hjem-collection-name">{label}</span>
        <span className="hjem-collection-count">{countText}</span>
      </span>
    </button>
  )
}
