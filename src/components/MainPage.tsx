import { useState, useEffect } from 'react'
import { useNavigate, useLocation, useParams } from 'react-router-dom'
import JoinOverlay from './JoinOverlay'
import Slideshow from './Slideshow'
import PhotoUpload from './PhotoUpload'
import MusicPanel from './MusicPanel'
import { useSessionEnd } from '../hooks/useSessionEnd'
import { usePhotos } from '../hooks/usePhotos'
import { supabase } from '../lib/supabase'
import type { Session } from '../types/session'

export default function MainPage() {
  const { sessionId } = useParams<{ sessionId: string }>()
  const location = useLocation()
  const session = location.state?.session as Session
  const navigate = useNavigate()
  const { endSession, loading } = useSessionEnd()
  const [showJoinOverlay, setShowJoinOverlay] = useState(false)
  const [isHost, setIsHost] = useState(false)
  const [currentUserId, setCurrentUserId] = useState('')
  const { photos } = usePhotos(sessionId!)

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        setCurrentUserId(user.id)
        setIsHost(session?.host_auth_id === user.id)
      }
    })
  }, [session])

  useEffect(() => {
    if (!sessionId) return
    const channel = supabase
      .channel(`session-status:${sessionId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'sessions' },
        (payload) => {
          if (payload.new.id === sessionId && payload.new.status === 'ended') navigate('/')
        }
      )
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [sessionId, navigate])

  const handleEnd = async () => {
    if (!confirm('セッションを終了しますか？')) return
    const ok = await endSession(sessionId!)
    if (ok) navigate('/')
  }

  return (
    <div>
      {isHost && <Slideshow photos={photos} />}
      <PhotoUpload sessionId={sessionId!} photos={photos} currentUserId={currentUserId} />
      <MusicPanel sessionId={sessionId!} currentUserId={currentUserId} />
      {isHost && (
        <>
          <button aria-label="＋メンバー" onClick={() => setShowJoinOverlay(true)}>
            ＋メンバー
          </button>
          <button onClick={handleEnd} disabled={loading}>
            セッション終了
          </button>
        </>
      )}
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
