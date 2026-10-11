import { useEffect, useRef, useState, type CSSProperties, type ReactNode, type TouchEvent } from 'react'
import {
  ArrowDown,
  ArrowRight,
  Bell,
  BookOpen,
  CalendarDays,
  Check,
  ChevronLeft,
  Link,
  Share2,
  ShoppingBasket,
  Timer,
} from 'lucide-react'
import '../welcome.css'

// Klassene i welcome.css har prefikset vk-.
const k = (names: string) =>
  names
    .split(' ')
    .map((name) => `vk-${name}`)
    .join(' ')

// Forsinkelsen før et element i en scene animeres inn.
const d = (seconds: number, extra?: Record<string, string>) =>
  ({ '--d': `${seconds}s`, ...extra }) as CSSProperties

function KokTop({ bell }: { bell?: ReactNode }) {
  return (
    <div className={k('kd-top')}>
      <span>Avslutt</span>
      <span className={k('kd-top-right')}>
        <span className={k('kd-on')}>Skjermen står på</span>
        {bell}
      </span>
    </div>
  )
}

function KokFoot({ pressAt }: { pressAt?: number }) {
  return (
    <div className={k('kd-foot')}>
      <span className={k('kd-back')}>
        <ChevronLeft />
      </span>
      <span className={k(pressAt != null ? 'kd-next press' : 'kd-next')} style={pressAt != null ? d(pressAt) : undefined}>
        Neste steg
      </span>
    </div>
  )
}

function NeedPanel({ items }: { items: [string, string][] }) {
  return (
    <div className={k('kd-need')}>
      <b>Du trenger nå</b>
      {items.map(([name, amount]) => (
        <div key={name}>
          <span>{name}</span>
          <span>{amount}</span>
        </div>
      ))}
    </div>
  )
}

function ImportScene() {
  return (
    <div className={k('scene run s1')}>
      <div className={k('mini rcard in')} style={d(3.1)}>
        <div className={k('rc-img')} />
        <h4>Lasagne</h4>
        <span className={k('tag')}>Middag</span>
        <ul>
          <li>
            <span>Kjøttdeig</span>
            <span>400 g</span>
          </li>
          <li>
            <span>Løk</span>
            <span>1 stk</span>
          </li>
          <li>
            <span>Lasagneplater</span>
            <span>9 stk</span>
          </li>
        </ul>
      </div>
      <div className={k('photo out')} style={d(2.9)}>
        {[100, 100, 85, 70, 100, 90, 55, 100, 75].map((width, index) => (
          <i key={index} style={index === 0 ? undefined : { width: `${width}%` }} />
        ))}
        <div className={k('scan')} />
      </div>
      <div className={k('chip url in')} style={d(4.6)}>
        <span>
          <Link />
          coop.no/oppskrifter/lasagne
        </span>
        <span className={k('ok pop')} style={d(5.4)}>
          <Check />
        </span>
      </div>
    </div>
  )
}

function CookingScene() {
  return (
    <div className={k('scene run s2')}>
      <div className={k('mini-dark')}>
        <KokTop />
        <div className={k('kd-prog')}>
          <i className={k('full')} />
          <i>
            <b style={d(3.4)} />
          </i>
          <i />
          <i />
        </div>
        <div className={k('kd-body')}>
          <div className={k('kd-layer in')} style={d(3.5)}>
            <span className={k('kd-k')}>Steg 2 av 4</span>
            <div className={k('kd-t')}>Rør inn tomatene og la det småkoke</div>
            <NeedPanel
              items={[
                ['Hermetiske tomater', '2 bokser'],
                ['Hvitløk', '2 fedd'],
              ]}
            />
          </div>
          <div className={k('kd-layer out')} style={d(3.2)}>
            <span className={k('kd-k')}>Steg 1 av 4</span>
            <div className={k('kd-t')}>Brun kjøttdeigen sammen med løken</div>
            <NeedPanel
              items={[
                ['Kjøttdeig', '400 g'],
                ['Løk', '1 stk'],
              ]}
            />
          </div>
        </div>
        <KokFoot pressAt={2.8} />
      </div>
    </div>
  )
}

function TimerScene() {
  return (
    <div className={k('scene run s3')}>
      <div className={k('mini-dark')}>
        <KokTop
          bell={
            <span className={k('kd-bell')}>
              <Bell />
              <em className={k('pop')} style={d(4.6)}>
                2
              </em>
            </span>
          }
        />
        <div className={k('kd-prog')}>
          <i className={k('full')} />
          <i className={k('full')} />
          <i className={k('full')} />
          <i />
        </div>
        <div className={k('kd-body')}>
          <div className={k('kd-layer')}>
            <span className={k('kd-k')}>Steg 3 av 4</span>
            <div className={k('kd-t')}>
              Stek i ovnen i <u>12 minutter</u>
            </div>
            <span className={k('kd-start tapout')} style={d(1.9)}>
              <Timer />
              Start 12 min
            </span>
            <div className={k('kd-timer in')} style={d(2.5)}>
              <span className={k('kd-clock')}>
                11:5
                <span className={k('strip')} style={d(2.9)}>
                  {[9, 8, 7, 6, 5, 4].map((digit) => (
                    <span key={digit}>{digit}</span>
                  ))}
                </span>
              </span>
              <span className={k('kd-pause')}>Pause</span>
            </div>
            <span className={k('kd-pill in')} style={d(4.4)}>
              <Timer />
              Ris · 04:10
            </span>
          </div>
        </div>
        <KokFoot />
      </div>
    </div>
  )
}

function ShoppingRow({ name, amount, at }: { name: string; amount: ReactNode; at: number }) {
  return (
    <div className={k('it in')} style={d(at)}>
      <span className={k('cb')} />
      <span className={k('nm')}>{name}</span>
      <span className={k('amt')}>{amount}</span>
    </div>
  )
}

function MenuScene() {
  const fly = (name: string, left: number, at: number) => (
    <span className={k('chip fly')} style={d(at, { left: `${left}px` })}>
      {name}
    </span>
  )
  return (
    <div className={k('scene run s4')}>
      <div className={k('mini menu')}>
        <h4>Ukesmeny</h4>
        <div className={k('day in')} style={d(0.4)}>
          <small>Man</small>Lasagne
        </div>
        <div className={k('day in')} style={d(4.4)}>
          <small>Tir</small>Fiskesuppe
        </div>
      </div>
      <span className={k('down')}>
        <ArrowDown />
      </span>
      {fly('Kjøttdeig', 38, 1.3)}
      {fly('Løk', 138, 1.5)}
      {fly('Torsk', 20, 5.3)}
      {fly('Løk', 98, 5.5)}
      {fly('Fløte', 164, 5.7)}
      <div className={k('mini list')}>
        <h4>Handleliste</h4>
        <ShoppingRow name="Kjøttdeig" amount="400 g" at={2.3} />
        <ShoppingRow
          name="Løk"
          at={2.5}
          amount={
            <>
              <span className={k('old out')} style={d(6.5)}>
                1 stk
              </span>
              <span className={k('new pop')} style={d(6.6)}>
                2 stk
              </span>
            </>
          }
        />
        <ShoppingRow name="Torsk" amount="400 g" at={6.3} />
        <ShoppingRow name="Fløte" amount="3 dl" at={6.7} />
      </div>
    </div>
  )
}

function GroupScene({ groupName }: { groupName: string }) {
  const shared: [typeof Check, string, number][] = [
    [CalendarDays, 'Ukesmeny', 4.0],
    [ShoppingBasket, 'Handleliste', 4.4],
    [BookOpen, 'Alles oppskrifter', 4.8],
  ]
  return (
    <div className={k('scene run s5')}>
      <span className={k('grp in')} style={d(0.3)}>
        {groupName}
      </span>
      <div className={k('avs')}>
        <span className={k('av')}>H</span>
        <span className={k('av m pop')} style={d(2.2)}>
          M
        </span>
        <span className={k('av a pop')} style={d(2.7)}>
          A
        </span>
      </div>
      <span className={k('chip inv in')} style={d(1.1)}>
        <Link />
        Invitasjonslenke sendt
      </span>
      <div className={k('mini sh in')} style={d(3.6)}>
        <span className={k('gk')}>Felles for gruppen</span>
        {shared.map(([Icon, label, at]) => (
          <div className={k('sr in')} style={d(at)} key={label}>
            <span>
              <Icon />
            </span>
            <span className={k('nm')}>{label}</span>
            <span className={k('ck')}>
              <Check />
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

function ShareScene() {
  const received: [string, number][] = [
    ['Lasagne', 2.0],
    ['Fiskesuppe', 5.2],
    ['Taco', 5.4],
    ['Eplekake', 5.6],
  ]
  return (
    <div className={k('scene run s6')}>
      <div className={k('mini g gl')}>
        <span className={k('gk')}>Gruppe</span>
        <h4>Hansen</h4>
        <div className={k('mavs')}>
          <span className={k('av')}>H</span>
          <span className={k('av m')}>M</span>
        </div>
        {received.map(([name]) => (
          <div className={k('rr')} key={name}>
            {name}
          </div>
        ))}
      </div>
      <span className={k('mid')}>
        <ArrowRight />
      </span>
      <span className={k('chip flyx')} style={d(1, { '--t': '76px' })}>
        <Share2 />
        Lasagne
      </span>
      <span className={k('chip flyx')} style={d(4.2, { '--t': '120px' })}>
        <BookOpen />
        Hele kokeboka
      </span>
      <div className={k('mini g gr')}>
        <span className={k('gk')}>Gruppe</span>
        <h4>Berg</h4>
        <div className={k('mavs')}>
          <span className={k('av a')}>A</span>
          <span className={k('av k')}>K</span>
        </div>
        <div className={k('rr')}>Pizza</div>
        {received.map(([name, at]) => (
          <div className={k('rr in')} style={d(at)} key={name}>
            {name}
            <small>Fra Hansen</small>
          </div>
        ))}
      </div>
    </div>
  )
}

interface Page {
  title: string
  text: string
  // Hvor lenge scenen står før den spilles på nytt.
  loopMs: number
  scene: ReactNode
}

interface WelcomeProps {
  /** Navnet på gruppen brukeren allerede er med i, f.eks. etter en invitasjonslenke. */
  groupName: string | null
  /** Kalles når velkomsten lukkes. addRecipe er sann når brukeren vil legge inn en oppskrift. */
  onDone: (addRecipe: boolean) => void
}

export function Welcome({ groupName, onDone }: WelcomeProps) {
  const pages: Page[] = [
    {
      title: 'Få oppskriftene inn på sekunder',
      text: 'Ta bilde, lim inn en lenke, eller skriv selv.',
      loopMs: 8500,
      scene: <ImportScene />,
    },
    {
      title: 'Ett steg om gangen',
      text: 'Du ser bare det du trenger akkurat nå.',
      loopMs: 7500,
      scene: <CookingScene />,
    },
    {
      title: 'Klokka er klar når du er',
      text: 'Står det en tid i steget, dukker klokka opp. Trykk for å starte, og ha flere gående samtidig.',
      loopMs: 9000,
      scene: <TimerScene />,
    },
    {
      title: 'Fra ukesmeny til handleliste',
      text: 'Legg en rett på en dag, så havner ingrediensene på handlelisten.',
      loopMs: 9500,
      scene: <MenuScene />,
    },
    {
      title: groupName ? `Du er med i ${groupName}` : 'Lag mat sammen',
      text: groupName
        ? 'Dere har felles ukesmeny, handleliste og oppskrifter. Inviter flere med en lenke.'
        : 'Opprett en gruppe og inviter de du bor med. Da får dere felles ukesmeny, handleliste og oppskrifter.',
      loopMs: 8000,
      scene: <GroupScene groupName={groupName ?? 'Familien Hansen'} />,
    },
    {
      title: 'Del med andre grupper',
      text: 'Send én oppskrift, en samling eller hele kokeboka til en annen gruppe.',
      loopMs: 8500,
      scene: <ShareScene />,
    },
  ]

  const [index, setIndex] = useState(0)
  // Økes for å montere scenen på nytt, slik at animasjonen starter forfra.
  const [replay, setReplay] = useState(0)
  const touchStartX = useRef<number | null>(null)

  const page = pages[index]
  const isLast = index === pages.length - 1

  useEffect(() => {
    const timer = setInterval(() => setReplay((count) => count + 1), page.loopMs)
    return () => clearInterval(timer)
  }, [index, page.loopMs])

  function go(next: number) {
    setIndex(Math.max(0, Math.min(pages.length - 1, next)))
  }

  function handleTouchEnd(e: TouchEvent) {
    const start = touchStartX.current
    touchStartX.current = null
    if (start == null) return
    const delta = e.changedTouches[0].clientX - start
    if (Math.abs(delta) > 50) go(index + (delta < 0 ? 1 : -1))
  }

  return (
    <div className={k('welcome')} role="dialog" aria-modal="true" aria-label="Velkommen til Kokeboka">
      <div
        className={k('inner')}
        onTouchStart={(e) => {
          touchStartX.current = e.touches[0].clientX
        }}
        onTouchEnd={handleTouchEnd}
      >
        <div className={k('w-top')}>
          <span className={k('w-brand')}>Kokeboka</span>
          {!isLast && (
            <button type="button" className={k('w-skip')} onClick={() => onDone(false)}>
              Hopp over
            </button>
          )}
        </div>

        <section className={k('w-page')}>
          <div className={k('stage')} aria-hidden="true" key={`${index}-${replay}`}>
            {page.scene}
          </div>
          <div className={k('w-text')}>
            <h2>{page.title}</h2>
            <p>{page.text}</p>
          </div>
        </section>

        <div className={k('w-foot')}>
          <div className={k('dots')}>
            {pages.map((p, i) => (
              <button
                type="button"
                key={p.title}
                className={i === index ? k('on') : undefined}
                aria-label={`Side ${i + 1} av ${pages.length}`}
                aria-current={i === index}
                onClick={() => go(i)}
              />
            ))}
          </div>
          <button type="button" className="cta-button" onClick={() => (isLast ? onDone(true) : go(index + 1))}>
            {isLast ? 'Legg inn første oppskrift' : 'Neste'}
          </button>
          <button
            type="button"
            className={k('w-alt')}
            style={isLast ? undefined : { visibility: 'hidden' }}
            onClick={() => onDone(false)}
          >
            Utforsk selv
          </button>
        </div>
      </div>
    </div>
  )
}
