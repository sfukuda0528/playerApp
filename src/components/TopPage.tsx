import { useNavigate } from 'react-router-dom'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faCampground, faPlay, faRightToBracket } from '@fortawesome/free-solid-svg-icons'

export default function TopPage() {
  const navigate = useNavigate()
  return (
    <div className="flex flex-col min-h-screen" style={{ background: 'linear-gradient(170deg, #fdf6ec, #fff8f0)' }}>
      <header
        className="py-10 flex flex-col items-center gap-2 relative overflow-hidden"
        style={{ background: 'linear-gradient(160deg, #5a2800 0%, #7c4a1e 55%, #b06228 100%)' }}
      >
        <div
          className="absolute inset-0"
          style={{ background: 'radial-gradient(ellipse at 50% 110%, rgba(224,123,57,0.35), transparent 65%)' }}
        />
        <FontAwesomeIcon
          icon={faCampground}
          className="text-5xl text-camp-cream relative z-10"
          style={{ filter: 'drop-shadow(0 2px 8px rgba(224,123,57,0.6))' }}
        />
        <h1 className="text-camp-cream font-bold text-2xl tracking-widest relative z-10">CampCanvas</h1>
        <p className="text-camp-cream/60 text-sm relative z-10">思い出を、みんなで。</p>
      </header>
      <main className="flex flex-col items-center justify-center flex-1 gap-3 px-6">
        <button
          onClick={() => navigate('/create')}
          className="w-full max-w-sm text-white font-bold text-base py-3.5 rounded-2xl active:scale-95 transition-all duration-150 flex items-center justify-center gap-2"
          style={{
            background: 'linear-gradient(135deg, #e07b39, #c8601a)',
            boxShadow: '0 6px 18px rgba(224,123,57,0.45), 0 2px 4px rgba(200,96,26,0.3)',
          }}
        >
          <FontAwesomeIcon icon={faPlay} />
          セッション開始
        </button>
        <button
          onClick={() => navigate('/join')}
          className="w-full max-w-sm text-camp-orange font-bold text-base py-3.5 rounded-2xl border-2 border-camp-orange active:scale-95 transition-all duration-150 flex items-center justify-center gap-2"
          style={{
            background: 'linear-gradient(135deg, #fff8f0, white)',
            boxShadow: '0 4px 12px rgba(224,123,57,0.15)',
          }}
        >
          <FontAwesomeIcon icon={faRightToBracket} />
          セッションに参加
        </button>
      </main>
    </div>
  )
}
