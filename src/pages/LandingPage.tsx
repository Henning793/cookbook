import { Login } from '../components/Login'
import { InstallBanner } from '../components/InstallApp'

/** Forsiden for den som ikke er logget inn: innlogging og registrering. */
export function LandingPage() {
  return (
    <div className="page landing-page">
      <div className="landing-hero">
        <img className="landing-icon" src="/icons/icon-192.png" alt="" width={72} height={72} />
        <h1 className="hjem-title">Kokeboka</h1>
        <p className="landing-tagline">
          Oppskrifter, ukesmeny og handleliste på ett sted.
        </p>
      </div>

      <Login />

      <InstallBanner />
    </div>
  )
}
