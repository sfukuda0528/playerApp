import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
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
    <div className="flex flex-col min-h-screen bg-camp-cream">
      <header className="bg-camp-brown px-4 py-3 flex items-center">
        <button
          onClick={() => navigate(-1)}
          className="text-camp-cream text-sm font-medium"
        >
          ← 戻る
        </button>
        <h2 className="text-camp-cream font-bold text-sm mx-auto">セッション作成</h2>
      </header>
      <main className="flex flex-col items-center justify-center flex-1 px-6">
        <form
          onSubmit={handleSubmit}
          className="w-full max-w-sm bg-camp-warm-white border border-camp-wheat rounded-2xl p-6 flex flex-col gap-4"
        >
          <label className="flex flex-col gap-1.5">
            <span className="text-camp-brown text-sm font-semibold">ニックネーム</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="ニックネーム"
              className="bg-camp-cream border border-camp-wheat rounded-lg px-3 py-2.5 text-camp-dark text-sm placeholder:text-camp-wheat/80 outline-none focus:border-camp-orange"
            />
          </label>
          {error && <p role="alert" className="text-camp-destructive text-xs">{error}</p>}
          <button
            type="submit"
            disabled={loading || !name.trim()}
            className="bg-camp-orange text-white font-bold py-3 rounded-xl disabled:opacity-40"
          >
            {loading ? '作成中...' : 'セッションを作成'}
          </button>
        </form>
      </main>
    </div>
  )
}
