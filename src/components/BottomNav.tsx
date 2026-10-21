import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { BookOpen, CalendarDays, Plus, ShoppingCart, User, type LucideIcon } from 'lucide-react'
import { useApp } from '../context/AppContext'
import { countShoppingItemsLeft } from '../lib/shoppingCount'
import { cachedShopping } from '../lib/shoppingCache'
import { loadShoppingData } from '../lib/shoppingLoad'
import { currentWeekStart } from '../lib/menuWeeks'

type Tab = 'oppskrifter' | 'ukesmeny' | 'handleliste' | 'meg'

// Sider uten bunnmeny: kokemodus trenger hele skjermen, skjemaet for ny
// oppskrift har egen lagreknapp nederst, og invitasjons- og delingslenker er
// egne flyter, det samme er siden for nytt passord.
function hidesNav(pathname: string): boolean {
  return (
    /^\/oppskrift\/[^/]+\/kok$/.test(pathname) ||
    pathname === '/ny' ||
    pathname === '/nytt-passord' ||
    pathname.startsWith('/bli-med/') ||
    pathname.startsWith('/del/')
  )
}

function activeTab(pathname: string): Tab {
  if (pathname.startsWith('/ukesmeny')) return 'ukesmeny'
  if (pathname.startsWith('/handleliste')) return 'handleliste'
  if (pathname === '/meg' || pathname === '/familie' || pathname === '/tips') return 'meg'
  return 'oppskrifter'
}

const TABS: { tab: Tab; label: string; path: string; Icon: LucideIcon }[] = [
  { tab: 'oppskrifter', label: 'Oppskrifter', path: '/', Icon: BookOpen },
  { tab: 'ukesmeny', label: 'Ukesmeny', path: '/ukesmeny', Icon: CalendarDays },
  { tab: 'handleliste', label: 'Handleliste', path: '/handleliste', Icon: ShoppingCart },
  { tab: 'meg', label: 'Meg', path: '/meg', Icon: User },
]

export function BottomNav() {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const { session, recipes, loading: recipesLoading, family, familyLoading } = useApp()
  const userId = session?.user.id ?? null
  const [itemsLeft, setItemsLeft] = useState(0)
  const visible = !!session && !hidesNav(pathname)

  // Siden får plass til menyen nederst (se .has-bottom-nav i App.css).
  useEffect(() => {
    document.body.classList.toggle('has-bottom-nav', visible)
    return () => document.body.classList.remove('has-bottom-nav')
  }, [visible])

  // Telles på nytt ved hvert sidebytte, så merket stemmer når man kommer
  // tilbake fra handlelisten eller ukesmenyen. Den sist hentede listen gir
  // et tall med en gang, og hentingen deles med handlelisten.
  useEffect(() => {
    if (!visible || !userId) return
    const familyId = familyLoading ? undefined : (family?.id ?? null)
    const cached = cachedShopping(localStorage, userId, familyId, currentWeekStart())
    if (cached) setItemsLeft(countShoppingItemsLeft(cached, recipesLoading ? cached.recipes : recipes))
    if (familyId === undefined) return
    let cancelled = false
    loadShoppingData(userId, familyId, recipesLoading ? null : recipes)
      .then((data) => {
        if (cancelled) return
        const known = recipesLoading ? cachedShopping(localStorage, userId, familyId, currentWeekStart())?.recipes ?? [] : recipes
        setItemsLeft(countShoppingItemsLeft(data, known))
      })
      .catch(() => {
        // Merket er bare en hjelp. Uten svar vises det ikke.
        if (!cancelled) setItemsLeft(0)
      })
    return () => {
      cancelled = true
    }
  }, [visible, userId, family, familyLoading, recipes, recipesLoading, pathname])

  if (!visible) return null

  const current = activeTab(pathname)
  const button = ({ tab, label, path, Icon }: (typeof TABS)[number]) => (
    <button
      key={tab}
      type="button"
      className={'bottom-nav-tab' + (tab === current ? ' bottom-nav-tab-active' : '')}
      aria-current={tab === current ? 'page' : undefined}
      onClick={() => navigate(path)}
    >
      <span className="bottom-nav-icon">
        <Icon size={22} strokeWidth={tab === current ? 2.25 : 1.75} aria-hidden="true" />
        {tab === 'handleliste' && itemsLeft > 0 && (
          <span className="bottom-nav-badge" aria-label={`${itemsLeft} ${itemsLeft === 1 ? 'vare' : 'varer'} igjen`}>
            {itemsLeft > 99 ? '99+' : itemsLeft}
          </span>
        )}
      </span>
      <span className="bottom-nav-label">{label}</span>
    </button>
  )

  return (
    <nav className="bottom-nav" aria-label="Hovedmeny">
      {button(TABS[0])}
      {button(TABS[1])}
      <button type="button" className="bottom-nav-add" aria-label="Ny oppskrift" onClick={() => navigate('/ny')}>
        <Plus size={26} strokeWidth={2.5} aria-hidden="true" />
      </button>
      {button(TABS[2])}
      {button(TABS[3])}
    </nav>
  )
}
