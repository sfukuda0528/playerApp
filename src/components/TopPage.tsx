import { useNavigate } from 'react-router-dom'

export default function TopPage() {
  const navigate = useNavigate()
  return (
    <div className="flex flex-col min-h-screen bg-camp-cream">
      <header className="bg-camp-brown py-10 flex flex-col items-center gap-2">
        <span className="text-5xl">🏕</span>
        <h1 className="text-camp-cream font-bold text-2xl tracking-wide">CampCanvas</h1>
        <p className="text-camp-cream/70 text-sm">思い出を、みんなで。</p>
      </header>
      <main className="flex flex-col items-center justify-center flex-1 gap-4 px-6">
        <button
          onClick={() => navigate('/create')}
          className="w-full max-w-sm bg-camp-orange text-white font-bold text-base py-3 rounded-xl shadow-sm"
        >
          セッション開始
        </button>
        <button
          onClick={() => navigate('/join')}
          className="w-full max-w-sm bg-camp-warm-white text-camp-orange font-bold text-base py-3 rounded-xl border-2 border-camp-orange"
        >
          セッションに参加
        </button>
      </main>
    </div>
  )
}
