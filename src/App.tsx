import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AppProvider } from './context/AppContext'
import { HjemPage } from './pages/HjemPage'
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
import { UpdateBanner } from './components/UpdateBanner'
import { TimerProvider } from './context/TimerContext'
import { TimerTray } from './components/CookingTimers'
import './App.css'
import './recipe-components.css'

function App() {
  return (
    <AppProvider>
      <TimerProvider>
        <UpdateBanner />
        <BrowserRouter>
          <TimerTray />
          <Routes>
            <Route path="/" element={<HjemPage />} />
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
            <Route path="*" element={<HjemPage />} />
          </Routes>
        </BrowserRouter>
      </TimerProvider>
    </AppProvider>
  )
}

export default App
