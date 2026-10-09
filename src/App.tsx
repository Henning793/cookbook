import { BrowserRouter, Navigate, Routes, Route } from 'react-router-dom'
import { AppProvider, useApp } from './context/AppContext'
import { HjemPage } from './pages/HjemPage'
import { LandingPage } from './pages/LandingPage'
import { SamlingPage } from './pages/SamlingPage'
import { SamlingerPage } from './pages/SamlingerPage'
import { OppskriftPage } from './pages/OppskriftPage'
import { KokemodusPage } from './pages/KokemodusPage'
import { NyOppskriftPage } from './pages/NyOppskriftPage'
import { SokPage } from './pages/SokPage'
import { ProfilPage } from './pages/ProfilPage'
import { FamiliePage } from './pages/FamiliePage'
import { UkesmenyPage } from './pages/UkesmenyPage'
import { HandlelistePage } from './pages/HandlelistePage'
import { FasteVarerPage } from './pages/FasteVarerPage'
import { BliMedPage } from './pages/BliMedPage'
import { DelingPage } from './pages/DelingPage'
import { pendingLink } from './lib/inviteLinks'
import { UpdateBanner } from './components/UpdateBanner'
import { TimerProvider } from './context/TimerContext'
import { TimerTray } from './components/CookingTimers'
import './App.css'
import './recipe-components.css'

// Forsiden er en landingsside med innlogging for den som ikke er logget inn.
// En innlogget bruker sendes videre til en invitasjons- eller delingslenke
// som ble åpnet før innlogging, f.eks. når e-postbekreftelsen etter
// registrering åpner appen på nytt uten lenken i adressen.
function Home() {
  const { session, sessionLoading } = useApp()
  if (sessionLoading) return null
  if (!session) return <LandingPage />
  const pending = pendingLink()
  return pending ? <Navigate to={pending} replace /> : <HjemPage />
}

function App() {
  return (
    <AppProvider>
      <TimerProvider>
        <UpdateBanner />
        <BrowserRouter>
          <TimerTray />
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/samling/:tag" element={<SamlingPage />} />
            <Route path="/samlinger" element={<SamlingerPage />} />
            <Route path="/samlinger/:id" element={<SamlingPage />} />
            <Route path="/oppskrift/:id" element={<OppskriftPage />} />
            <Route path="/oppskrift/:id/kok" element={<KokemodusPage />} />
            <Route path="/ny" element={<NyOppskriftPage />} />
            <Route path="/sok" element={<SokPage />} />
            <Route path="/meg" element={<ProfilPage />} />
            <Route path="/familie" element={<FamiliePage />} />
            <Route path="/ukesmeny" element={<UkesmenyPage />} />
            <Route path="/handleliste" element={<HandlelistePage />} />
            <Route path="/handleliste/faste" element={<FasteVarerPage />} />
            <Route path="/bli-med/:token" element={<BliMedPage />} />
            <Route path="/del/:token" element={<DelingPage />} />
            <Route path="*" element={<Home />} />
          </Routes>
        </BrowserRouter>
      </TimerProvider>
    </AppProvider>
  )
}

export default App
