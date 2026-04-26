import { useState } from 'react'
import { useNavigate, useLocation, useParams } from 'react-router-dom'
import JoinOverlay from './JoinOverlay'
import { useSessionEnd } from '../hooks/useSessionEnd'
import type { Session } from '../types/session'

export default function MainPage() {
  const { sessionId } = useParams<{ sessionId: string }>()
  const location = useLocation()
  const session = location.state?.session as Session
  const navigate = useNavigate()
  const { endSession, loading } = useSessionEnd()
  const [showJoinOverlay, setShowJoinOverlay] = useState(false)

  const handleEnd = async () => {
    if (!confirm('セッションを終了しますか？')) return
    const ok = await endSession(sessionId!)
    if (ok) navigate('/')
  }

  return (
    <div>
      <div aria-label="スライドショー">スライドショー表示エリア</div>
      <button aria-label="＋メンバー" onClick={() => setShowJoinOverlay(true)}>
        ＋メンバー
      </button>
      <button onClick={handleEnd} disabled={loading}>
        セッション終了
      </button>
      {showJoinOverlay && session && (
        <JoinOverlay
          sessionId={sessionId!}
          code={session.code}
          onClose={() => setShowJoinOverlay(false)}
        />
      )}
    </div>
  )
}
