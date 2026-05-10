import { useEffect, useState } from 'react'
import { useNavigate, useParams, useLocation } from 'react-router-dom'
import QRCode from 'qrcode'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faCrown, faUsers, faPlay } from '@fortawesome/free-solid-svg-icons'
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
    <div className="flex flex-col min-h-screen" style={{ background: 'linear-gradient(170deg, #fdf6ec, #fff8f0)' }}>
      <header
        className="px-4 py-3 flex items-center justify-center"
        style={{ background: 'linear-gradient(135deg, #5a2800, #7c4a1e, #b06228)' }}
      >
        <h2 className="text-camp-cream font-bold text-sm">メンバーを招待</h2>
      </header>
      <main className="flex flex-col items-center justify-center flex-1 gap-5 px-6">
        <div
          className="bg-white rounded-2xl p-6 flex flex-col items-center gap-4 w-full max-w-xs"
          style={{ boxShadow: '0 6px 24px rgba(124,74,30,0.14)', border: '1px solid rgba(240,200,150,0.4)' }}
        >
          {qrUrl ? (
            <img src={qrUrl} alt="QR Code" className="w-36 h-36 rounded-xl" />
          ) : qrError ? (
            <p className="text-camp-destructive text-xs">QR生成に失敗</p>
          ) : null}
          <span
            className="text-camp-cream font-bold tracking-widest px-6 py-1.5 rounded-lg text-lg"
            style={{ background: 'linear-gradient(135deg, #e07b39, #c8601a)' }}
          >
            {session?.code}
          </span>
          <p className="text-camp-amber text-sm font-medium flex items-center gap-1.5">
            <FontAwesomeIcon icon={faUsers} className="text-xs" />
            {participants.length} / {MAX_PARTICIPANTS} 人参加中
          </p>
          <ul className="w-full space-y-1">
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
        </div>
        <button
          onClick={() => navigate(`/session/${sessionId}`, { state: { session } })}
          className="w-full max-w-xs text-white font-bold py-3 rounded-xl active:scale-95 transition-all duration-150 flex items-center justify-center gap-2"
          style={{
            background: 'linear-gradient(135deg, #e07b39, #c8601a)',
            boxShadow: '0 6px 16px rgba(224,123,57,0.4)',
          }}
        >
          <FontAwesomeIcon icon={faPlay} />
          スタート
        </button>
      </main>
    </div>
  )
}
