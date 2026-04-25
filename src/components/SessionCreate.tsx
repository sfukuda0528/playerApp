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
    <form onSubmit={handleSubmit}>
      <h2>あなたの名前を入力</h2>
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="ニックネーム"
      />
      {error && <p role="alert">{error}</p>}
      <button type="submit" disabled={loading || !name.trim()}>
        {loading ? '作成中...' : 'セッションを作成'}
      </button>
    </form>
  )
}
