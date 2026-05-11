import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faChevronLeft, faUser, faCampground } from '@fortawesome/free-solid-svg-icons'
import { useSessionCreate } from '../hooks/useSessionCreate'

export default function SessionCreate() {
  const [name, setName] = useState('')
  const navigate = useNavigate()
  const { createSession, loading, error } = useSessionCreate()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    const session = await createSession(name.trim())
    if (session) navigate(`/invite/${session.id}`, { state: { session } })
  }

  return (
    <div className="flex flex-col min-h-screen" style={{ background: 'linear-gradient(170deg, #fdf6ec, #fff8f0)' }}>
      <header
        className="px-4 py-3 flex items-center"
        style={{ background: 'linear-gradient(135deg, #5a2800, #7c4a1e, #b06228)' }}
      >
        <button
          onClick={() => navigate(-1)}
          className="text-camp-cream/70 text-sm font-medium flex items-center gap-1 active:scale-95 transition-all duration-150"
        >
          <FontAwesomeIcon icon={faChevronLeft} className="text-xs" />
          戻る
        </button>
        <h2 className="text-camp-cream font-bold text-sm mx-auto">セッション作成</h2>
      </header>
      <main className="flex flex-col items-center justify-center flex-1 px-6">
        <form
          onSubmit={handleSubmit}
          className="w-full max-w-sm bg-white rounded-[18px] p-6 flex flex-col gap-4"
          style={{ boxShadow: '0 6px 24px rgba(124,74,30,0.14)', border: '1px solid rgba(240,200,150,0.4)' }}
        >
          <label className="flex flex-col gap-1.5">
            <span className="text-camp-brown text-sm font-semibold tracking-wide flex items-center gap-1.5">
              <FontAwesomeIcon icon={faUser} className="text-camp-amber text-xs" />
              ニックネーム
            </span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="ニックネーム"
              className="bg-camp-cream border-2 border-camp-wheat rounded-xl px-3 py-2.5 text-camp-dark text-base placeholder:text-camp-wheat/80 outline-none focus:border-camp-orange focus:ring-2 focus:ring-camp-orange/20 transition-all"
            />
          </label>
          {error && <p role="alert" className="text-camp-destructive text-xs">{error}</p>}
          <button
            type="submit"
            disabled={loading || !name.trim()}
            className="text-white font-bold py-3 rounded-xl disabled:opacity-40 active:scale-95 transition-all duration-150 flex items-center justify-center gap-2"
            style={{
              background: 'linear-gradient(135deg, #e07b39, #c8601a)',
              boxShadow: '0 6px 16px rgba(224,123,57,0.4)',
            }}
          >
            <FontAwesomeIcon icon={faCampground} />
            {loading ? '作成中...' : 'セッションを作成'}
          </button>
        </form>
      </main>
    </div>
  )
}
