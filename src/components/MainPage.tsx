import { useState, useEffect } from 'react'
import { useNavigate, useLocation, useParams } from 'react-router-dom'
import QRCode from 'qrcode'
import Slideshow from './Slideshow'
import PhotoUpload from './PhotoUpload'
import MusicPanel from './MusicPanel'
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs'
import { useSessionEnd } from '../hooks/useSessionEnd'
import { usePhotos } from '../hooks/usePhotos'
import { useParticipants } from '../hooks/useParticipants'
import { supabase } from '../lib/supabase'
import type { Session } from '../types/session'

export default function MainPage() {
  const { sessionId } = useParams<{ sessionId: string }>()
  const location = useLocation()
  const session = location.state?.session as Session
  const navigate = useNavigate()
  const { endSession, loading } = useSessionEnd()
  const [isHost, setIsHost] = useState(false)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const { photos } = usePhotos(sessionId!)
  const { participants } = useParticipants(sessionId ?? '')
  const [qrUrl, setQrUrl] = useState('')
  const [qrError, setQrError] = useState(false)

  const MAX_PARTICIPANTS = 4

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user }, error }) => {
      if (error || !user) return
      setCurrentUserId(user.id)
      setIsHost(session?.host_auth_id === user.id)
    })
  }, [session])

  useEffect(() => {
    if (!session?.code) return
    const joinUrl = `${window.location.origin}/join/${session.code}`
    QRCode.toDataURL(joinUrl).then(setQrUrl).catch(() => setQrError(true))
  }, [session?.code])

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

  const tabTriggerClass =
    'flex-1 flex flex-col gap-0.5 py-2 text-xs rounded-none bg-transparent ' +
    'text-camp-cream/60 data-[state=active]:text-camp-cream ' +
    'data-[state=active]:border-t-2 data-[state=active]:border-camp-orange ' +
    'data-[state=active]:bg-transparent data-[state=active]:shadow-none'

  return (
    <div className="flex flex-col h-screen bg-camp-cream">
      <header className="bg-camp-brown px-4 py-3 flex items-center justify-between flex-shrink-0">
        <span className="text-camp-cream font-bold text-sm">🏕 CampCanvas</span>
        <span className="text-camp-cream text-xs opacity-80">
          👥 {participants.length}/{MAX_PARTICIPANTS}
        </span>
      </header>

      <Tabs defaultValue="photo" className="flex flex-col flex-1 overflow-hidden">
        <TabsContent value="photo" className="flex-1 overflow-y-auto p-4 space-y-4 mt-0">
          {isHost && <Slideshow photos={photos} />}
          {currentUserId && (
            <PhotoUpload
              sessionId={sessionId!}
              photos={photos}
              currentUserId={currentUserId}
            />
          )}
        </TabsContent>

        <TabsContent value="music" forceMount className="flex-1 overflow-y-auto mt-0 data-[state=inactive]:hidden">
          {currentUserId && (
            <MusicPanel sessionId={sessionId!} currentUserId={currentUserId} />
          )}
        </TabsContent>

        <TabsContent value="member" className="flex-1 overflow-y-auto p-4 space-y-4 mt-0">
          <p className="text-center text-camp-amber text-sm font-medium">
            {participants.length} / {MAX_PARTICIPANTS} 人参加中
          </p>
          {isHost && (
            <>
              <div className="bg-camp-warm-white border border-camp-wheat rounded-xl p-4 flex flex-col items-center gap-3">
                {qrUrl ? (
                  <img src={qrUrl} alt="QR Code" className="w-32 h-32" />
                ) : qrError ? (
                  <p className="text-camp-destructive text-xs">QR生成に失敗</p>
                ) : null}
                <span className="bg-camp-wheat text-camp-brown font-bold tracking-widest px-4 py-1 rounded-md text-sm">
                  {session?.code}
                </span>
              </div>
              <button
                onClick={handleEnd}
                disabled={loading}
                className="w-full border-2 border-camp-destructive text-camp-destructive font-bold py-3 rounded-xl bg-transparent"
              >
                セッション終了
              </button>
            </>
          )}
        </TabsContent>

        <TabsList className="flex-shrink-0 bg-camp-brown w-full rounded-none h-auto py-0 justify-around">
          <TabsTrigger value="photo" className={tabTriggerClass}>
            <span>📸</span><span>写真</span>
          </TabsTrigger>
          <TabsTrigger value="music" className={tabTriggerClass}>
            <span>🎵</span><span>音楽</span>
          </TabsTrigger>
          <TabsTrigger value="member" className={tabTriggerClass}>
            <span>👥</span><span>メンバー</span>
          </TabsTrigger>
        </TabsList>
      </Tabs>
    </div>
  )
}
