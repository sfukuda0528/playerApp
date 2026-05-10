import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate, useLocation, useParams } from 'react-router-dom'
import QRCode from 'qrcode'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core'
import {
  faCampground, faCamera, faMusic, faUsers, faCrown,
} from '@fortawesome/free-solid-svg-icons'
import Slideshow from './Slideshow'
import PhotoUpload from './PhotoUpload'
import MusicPanel from './MusicPanel'
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs'
import { useSessionEnd } from '../hooks/useSessionEnd'
import { usePhotos } from '../hooks/usePhotos'
import { useParticipants } from '../hooks/useParticipants'
import { supabase } from '../lib/supabase'
import type { Session, Photo, MusicLink } from '../types/session'

export default function MainPage() {
  const { sessionId } = useParams<{ sessionId: string }>()
  const location = useLocation()
  const session = location.state?.session as Session
  const navigate = useNavigate()
  const { endSession, loading } = useSessionEnd()
  const [isHost, setIsHost] = useState(false)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const { participants } = useParticipants(sessionId ?? '')
  const [qrUrl, setQrUrl] = useState('')
  const [qrError, setQrError] = useState(false)
  const [toast, setToast] = useState<{ icon: IconDefinition; message: string; id: number } | null>(null)
  const toastIdRef = useRef(0)

  const MAX_PARTICIPANTS = 4

  const resolveName = useCallback(
    (authId: string) => participants.find((p) => p.auth_id === authId)?.name ?? 'メンバー',
    [participants]
  )

  const showToast = useCallback((icon: IconDefinition, message: string) => {
    const id = ++toastIdRef.current
    setToast({ icon, message, id })
  }, [])

  const { photos } = usePhotos(sessionId!, {
    onInsert: (photo: Photo) =>
      showToast(faCamera, `${resolveName(photo.uploader_auth_id)}さんが写真を追加しました`),
  })

  const handleMusicAdd = (link: MusicLink) =>
    showToast(faMusic, `${resolveName(link.added_by_auth_id)}さんが音楽を追加しました`)

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 3000)
    return () => clearTimeout(t)
  }, [toast?.id])

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
    'flex-1 flex flex-col gap-1 py-2 text-xs rounded-xl ' +
    'text-camp-cream/40 data-[state=active]:text-camp-cream ' +
    'data-[state=active]:bg-white/[0.13] ' +
    'bg-transparent transition-all duration-200 data-[state=active]:shadow-none'

  return (
    <div className="flex flex-col h-dvh" style={{ background: 'linear-gradient(170deg, #fdf6ec, #fff8f0)' }}>
      <header
        className="px-4 py-3 flex items-center justify-between flex-shrink-0"
        style={{ background: 'linear-gradient(135deg, #5a2800, #7c4a1e, #b06228)' }}
      >
        <span className="text-camp-cream font-bold text-sm flex items-center gap-1.5">
          <FontAwesomeIcon icon={faCampground} />
          CampCanvas
        </span>
        <div
          className="flex items-center gap-1 rounded-full px-2.5 py-1"
          style={{ background: 'rgba(253,246,236,0.12)' }}
        >
          <FontAwesomeIcon icon={faUsers} className="text-camp-cream/70 text-xs" />
          <span className="text-camp-cream/70 text-xs">{participants.length}/{MAX_PARTICIPANTS}</span>
        </div>
      </header>

      {toast && (
        <div
          role="status"
          className="text-camp-cream text-sm px-4 py-2 text-center flex-shrink-0 flex items-center justify-center gap-2 animate-slide-down"
          style={{ background: 'linear-gradient(135deg, rgba(61,32,3,0.92), rgba(90,40,0,0.92))' }}
        >
          <FontAwesomeIcon icon={toast.icon} />
          {toast.message}
        </div>
      )}

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
            <MusicPanel
              sessionId={sessionId!}
              currentUserId={currentUserId}
              isHost={isHost}
              onMusicAdd={handleMusicAdd}
            />
          )}
        </TabsContent>

        <TabsContent value="member" className="flex-1 overflow-y-auto p-4 space-y-4 mt-0">
          <p className="text-center text-camp-amber text-sm font-medium">
            {participants.length} / {MAX_PARTICIPANTS} 人参加中
          </p>
          <ul className="space-y-1">
            {[...participants]
              .sort((a, b) =>
                a.auth_id === session?.host_auth_id ? -1 :
                b.auth_id === session?.host_auth_id ? 1 : 0
              )
              .map((p) => (
                <li key={p.id} className="text-camp-brown text-sm text-center flex items-center justify-center gap-1">
                  {p.auth_id === session?.host_auth_id && (
                    <FontAwesomeIcon icon={faCrown} className="text-camp-amber text-xs" />
                  )}
                  {p.name}
                </li>
              ))}
          </ul>
          {isHost && (
            <>
              <div
                className="bg-white border border-camp-wheat rounded-xl p-4 flex flex-col items-center gap-3"
                style={{ boxShadow: '0 4px 14px rgba(124,74,30,0.10)' }}
              >
                {qrUrl ? (
                  <img src={qrUrl} alt="QR Code" className="w-32 h-32 rounded-lg" />
                ) : qrError ? (
                  <p className="text-camp-destructive text-xs">QR生成に失敗</p>
                ) : null}
                <span
                  className="text-camp-cream font-bold tracking-widest px-4 py-1 rounded-md text-sm"
                  style={{ background: 'linear-gradient(135deg, #e07b39, #c8601a)' }}
                >
                  {session?.code}
                </span>
              </div>
              <button
                onClick={handleEnd}
                disabled={loading}
                className="w-full border-2 border-camp-destructive text-camp-destructive font-bold py-3 rounded-xl bg-transparent active:scale-95 transition-all duration-150"
              >
                セッション終了
              </button>
            </>
          )}
        </TabsContent>

        <TabsList
          className="flex-shrink-0 w-full rounded-none h-auto py-1 px-1.5 gap-1 justify-around"
          style={{ background: 'linear-gradient(135deg, #5a2800, #7c4a1e)' }}
        >
          <TabsTrigger value="photo" className={tabTriggerClass}>
            <FontAwesomeIcon icon={faCamera} />
            <span>写真</span>
          </TabsTrigger>
          <TabsTrigger value="music" className={tabTriggerClass}>
            <FontAwesomeIcon icon={faMusic} />
            <span>音楽</span>
          </TabsTrigger>
          <TabsTrigger value="member" className={tabTriggerClass}>
            <FontAwesomeIcon icon={faUsers} />
            <span>メンバー</span>
          </TabsTrigger>
        </TabsList>
      </Tabs>
    </div>
  )
}
