import { useEffect, useState } from 'react'
import { useNavigate, useParams, useLocation } from 'react-router-dom'
import QRCode from 'qrcode'
import { useParticipants } from '../hooks/useParticipants'
import type { Session } from '../types/session'

export default function InviteScreen() {
  const { sessionId } = useParams<{ sessionId: string }>()
  const location = useLocation()
  const session = location.state?.session as Session | undefined
  const navigate = useNavigate()
  const [qrUrl, setQrUrl] = useState('')
  const [qrError, setQrError] = useState(false)
  const { participants } = useParticipants(sessionId ?? '')

  const MAX_PARTICIPANTS = 4

  const joinUrl = `${window.location.origin}/join/${session?.code}`

  useEffect(() => {
    if (session?.code) {
      QRCode.toDataURL(joinUrl).then(setQrUrl).catch(() => setQrError(true))
    }
  }, [joinUrl])

  if (!sessionId) return null

  return (
    <div className="flex flex-col min-h-screen bg-camp-cream">
      <header className="bg-camp-brown px-4 py-3 flex items-center justify-center">
        <h2 className="text-camp-cream font-bold text-sm">メンバーを招待</h2>
      </header>
      <main className="flex flex-col items-center justify-center flex-1 gap-5 px-6">
        <div className="bg-camp-warm-white border border-camp-wheat rounded-2xl p-6 flex flex-col items-center gap-4 w-full max-w-xs">
          {qrUrl ? (
            <img src={qrUrl} alt="QR Code" className="w-36 h-36 rounded-lg" />
          ) : qrError ? (
            <p className="text-camp-destructive text-xs">QR生成に失敗</p>
          ) : null}
          <span className="bg-camp-wheat text-camp-brown font-bold tracking-widest px-6 py-1.5 rounded-lg text-lg">
            {session?.code}
          </span>
          <p className="text-camp-amber text-sm font-medium">
            {participants.length} / {MAX_PARTICIPANTS} 人参加中
          </p>
        </div>
        <button
          onClick={() => navigate(`/session/${sessionId}`, { state: { session } })}
          className="w-full max-w-xs bg-camp-orange text-white font-bold py-3 rounded-xl shadow-sm"
        >
          スタート
        </button>
      </main>
    </div>
  )
}
