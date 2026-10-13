import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useApp } from '../context/AppContext'
import { Welcome } from '../components/Welcome'

const TIP_GROUPS: { heading: string; tips: [title: string, text: string][] }[] = [
  {
    heading: 'Legg inn',
    tips: [
      ['Fra bilde', 'Ta opptil seks bilder av en oppskrift, så leser appen den for deg.'],
      ['Fra lenke', 'Lim inn adressen til en oppskrift på nett, så hentes ingredienser og steg.'],
      ['Komponenter', 'Del oppskriften i deler som Marinade og Saus, hver med egne ingredienser.'],
      ['@-kobling', 'Skriv @ i et steg for å koble det til en komponent, så viser kokemodus bare de ingrediensene.'],
      ['Lenke til oppskrift', 'Skriv @ og navnet på en oppskrift i beskrivelsen, f.eks. @Rødvinssaus, så blir det en lenke dit.'],
      ['Tid på steg', 'Appen gjetter tiden fra teksten, og du kan overstyre den i skjemaet.'],
    ],
  },
  {
    heading: 'Lag mat',
    tips: [
      ['Porsjoner', 'Endre antall porsjoner, så regnes alle mengder om, også i kokemodus.'],
      ['Kokemodus', 'Ett steg om gangen, med ingrediensene du trenger nå og skjermen på.'],
      ['Tidtakere', 'Start en klokke fra steget. Flere kan gå samtidig, og de ligger bak bjella.'],
      ['Fortsett der du slapp', 'Forsiden husker hvilket steg du stoppet på.'],
    ],
  },
  {
    heading: 'Planlegg',
    tips: [
      ['Ukesmeny', 'Legg en oppskrift på hver dag, eller skriv fritekst som «Rester».'],
      ['Handleliste', 'Ingrediensene fra ukas retter slås sammen. Legg til egne varer nederst.'],
      ['Alltid hjemme', 'Varer du alltid har, som salt og olje, holdes utenfor handlelisten.'],
      ['Faste kjøp', 'Varer du kjøper hver uke legges til når du starter en ny ukesmeny.'],
    ],
  },
  {
    heading: 'Finn frem',
    tips: [
      ['Samlinger', 'Sett en etikett på en oppskrift, så havner den i en samling.'],
      ['Søk og filter', 'Søk i alle oppskrifter, og filtrer på etikett eller hvem som la den inn.'],
      [
        'Teknikker',
        'Det du slår opp en sjelden gang, som sous-vide, legger du inn som teknikk i stedet for oppskrift. De ligger bak lenken «Teknikker» på forsiden og dukker opp i søket.',
      ],
    ],
  },
  {
    heading: 'Del',
    tips: [
      ['Gruppe', 'Inviter med en lenke, og del kokebok, ukesmeny og handleliste.'],
      ['Del med andre', 'Del én oppskrift, en samling eller hele kokeboka med en annen gruppe.'],
    ],
  },
  {
    heading: 'Appen',
    tips: [
      ['Installer', 'Legg Kokeboka på hjemskjermen. På iPhone må den ligge der for at klokkene skal varsle.'],
    ],
  },
]

export function TipsPage() {
  const navigate = useNavigate()
  const { family } = useApp()
  const [openTip, setOpenTip] = useState<string | null>(null)
  const [showWelcome, setShowWelcome] = useState(false)

  return (
    <div className="page tips-page">
      <nav className="nav-bar">
        <button type="button" className="nav-link" onClick={() => navigate('/meg')}>
          <ChevronLeft size={14} strokeWidth={2.75} aria-hidden="true" />
          Meg
        </button>
      </nav>

      <h1 className="oppskrift-title">Tips og triks</h1>
      <p className="oppskrift-description">Små ting som gjør Kokeboka enklere å bruke.</p>

      {TIP_GROUPS.map((group) => (
        <section key={group.heading}>
          <h2 className="profil-kicker tips-kicker">{group.heading}</h2>
          <div className="profil-group">
            {group.tips.map(([title, text]) => {
              const open = openTip === title
              return (
                <div className="tips-tip" key={title}>
                  <button
                    type="button"
                    className="profil-row profil-row-button tips-row"
                    aria-expanded={open}
                    onClick={() => setOpenTip(open ? null : title)}
                  >
                    <span>{title}</span>
                    <span className={`profil-row-chevron tips-chevron${open ? ' tips-chevron-open' : ''}`} aria-hidden="true">
                      <ChevronRight size={14} strokeWidth={2.75} />
                    </span>
                  </button>
                  {open && <p className="tips-text">{text}</p>}
                </div>
              )
            })}
          </div>
        </section>
      ))}

      <button type="button" className="tips-welcome-link" onClick={() => setShowWelcome(true)}>
        Vis velkomsten på nytt
      </button>

      {showWelcome && (
        <Welcome
          groupName={family?.name ?? null}
          onDone={(addRecipe) => {
            setShowWelcome(false)
            if (addRecipe) navigate('/ny')
          }}
        />
      )}
    </div>
  )
}
