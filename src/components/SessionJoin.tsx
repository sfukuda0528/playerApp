import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useSessionJoin } from '../hooks/useSessionJoin'

export default function SessionJoin() {
  const { code: urlCode } = useParams<{ code?: string }>()
  const [code, setCode] = useState(urlCode ?? '')
  const [name, setName] = useState('')
  const navigate = useNavigate()
  const { joinSession, loading, error } = useSessionJoin()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!code.trim() || !name.trim()) return
    const result = await joinSession(code.trim(), name.trim())
    if (result) navigate(`/session/${result.session.id}`, { state: { session: result.session } })
  }

  return (
    <div className="flex flex-col min-h-screen bg-camp-cream">
      <header className="bg-camp-brown px-4 py-3 flex items-center">
        <button
          onClick={() => navigate(-1)}
          className="text-camp-cream text-sm font-medium"
        >
          ← 戻る
        </button>
        <h2 className="text-camp-cream font-bold text-sm mx-auto">セッション参加</h2>
      </header>
      <main className="flex flex-col items-center justify-center flex-1 px-6">
        <form
          onSubmit={handleSubmit}
          className="w-full max-w-sm bg-camp-warm-white border border-camp-wheat rounded-2xl p-6 flex flex-col gap-4"
        >
          <label className="flex flex-col gap-1.5">
            <span className="text-camp-brown text-sm font-semibold">6桁コード</span>
            <input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="123456"
              maxLength={6}
              className="bg-camp-cream border border-camp-wheat rounded-lg px-3 py-2.5 text-camp-dark text-base tracking-widest placeholder:text-camp-wheat/80 outline-none focus:border-camp-orange uppercase"
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-camp-brown text-sm font-semibold">ニックネーム</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="ニックネーム"
              className="bg-camp-cream border border-camp-wheat rounded-lg px-3 py-2.5 text-camp-dark text-base placeholder:text-camp-wheat/80 outline-none focus:border-camp-orange"
            />
          </label>
          {error && <p role="alert" className="text-camp-destructive text-xs">{error}</p>}
          <button
            type="submit"
            disabled={!code.trim() || !name.trim() || loading}
            className="bg-camp-orange text-white font-bold py-3 rounded-xl disabled:opacity-40"
          >
            参加する
          </button>
        </form>
      </main>
    </div>
  )
}
