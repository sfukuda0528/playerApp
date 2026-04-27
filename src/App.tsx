import { BrowserRouter, Routes, Route } from 'react-router-dom'
import TopPage from './components/TopPage'
import SessionCreate from './components/SessionCreate'
import InviteScreen from './components/InviteScreen'
import SessionJoin from './components/SessionJoin'
import MainPage from './components/MainPage'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<TopPage />} />
        <Route path="/create" element={<SessionCreate />} />
        <Route path="/invite/:sessionId" element={<InviteScreen />} />
        <Route path="/join/:code?" element={<SessionJoin />} />
        <Route path="/session/:sessionId" element={<MainPage />} />
      </Routes>
    </BrowserRouter>
  )
}
