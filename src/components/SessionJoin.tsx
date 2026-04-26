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
    <form onSubmit={handleSubmit}>
      <h2>セッションに参加</h2>
      <input
        value={code}
        onChange={(e) => setCode(e.target.value)}
        placeholder="6桁コード"
        maxLength={6}
      />
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="ニックネーム"
      />
      {error && <p role="alert">{error}</p>}
      <button type="submit" disabled={!code.trim() || !name.trim() || loading}>
        参加する
      </button>
    </form>
  )
}
