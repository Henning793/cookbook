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
import './App.css'

function App() {
  return (
    <AppProvider>
      <BrowserRouter>
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
          <Route path="*" element={<HjemPage />} />
        </Routes>
      </BrowserRouter>
    </AppProvider>
  )
}

export default App
