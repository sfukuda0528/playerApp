import { useEffect, useState } from 'react'
import { useNavigate, useParams, useLocation } from 'react-router-dom'
import QRCode from 'qrcode'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faCrown, faPlay } from '@fortawesome/free-solid-svg-icons'
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
  const sortedParticipants = [...participants].sort((a, b) =>
    a.auth_id === session?.host_auth_id ? -1 :
    b.auth_id === session?.host_auth_id ? 1 : 0
  )
  const emptySlotCount = Math.max(MAX_PARTICIPANTS - participants.length, 0)
  const emptySlots = Array.from({ length: emptySlotCount })

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
          <section
            className="w-full rounded-2xl p-4 text-camp-cream"
            style={{
              background: 'linear-gradient(135deg, #5a2800, #7c4a1e, #b06228)',
              boxShadow: '0 8px 22px rgba(90,40,0,0.18)',
            }}
          >
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-bold text-camp-cream/70">参加中</p>
                <p className="text-2xl font-black leading-tight">
                  {participants.length} / {MAX_PARTICIPANTS}
                </p>
                <p className="sr-only">{participants.length} / {MAX_PARTICIPANTS} 人参加中</p>
              </div>
              <span className="rounded-full bg-camp-cream/15 px-3 py-1.5 text-xs font-bold text-camp-cream">
                空き枠 {emptySlotCount}
              </span>
            </div>
            <div className="mt-4 flex items-center gap-2">
              {sortedParticipants.map((p) => {
                const isParticipantHost = p.auth_id === session?.host_auth_id
                const initial = p.name.trim().charAt(0).toUpperCase() || '?'

                return (
                  <span
                    key={p.id}
                    aria-label={`${p.name}のアバター`}
                    className={`relative grid h-11 w-11 place-items-center rounded-full border-2 text-sm font-black ${
                      isParticipantHost
                        ? 'border-camp-cream bg-camp-orange text-camp-cream'
                        : 'border-camp-cream/70 bg-camp-wheat text-camp-brown'
                    }`}
                  >
                    {initial}
                    {isParticipantHost && (
                      <FontAwesomeIcon
                        icon={faCrown}
                        className="absolute -right-1 -top-1 rounded-full bg-camp-dark p-1 text-[10px] text-camp-wheat"
                      />
                    )}
                  </span>
                )
              })}
              {emptySlots.map((_, index) => (
                <span
                  key={`empty-${index}`}
                  aria-hidden="true"
                  className="grid h-11 w-11 place-items-center rounded-full border-2 border-dashed border-camp-cream/40 text-sm font-bold text-camp-cream/60"
                >
                  +
                </span>
              ))}
            </div>
            <ul className="mt-4 space-y-2">
              {sortedParticipants.map((p) => {
                const isParticipantHost = p.auth_id === session?.host_auth_id

                return (
                  <li key={p.id} className="flex items-center justify-between gap-3 rounded-xl bg-camp-cream/10 px-3 py-2 text-sm">
                    <span className="min-w-0 truncate font-bold">{p.name}</span>
                    {isParticipantHost && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-camp-cream/15 px-2 py-1 text-[11px] font-bold text-camp-wheat">
                        <FontAwesomeIcon icon={faCrown} className="text-[10px]" />
                        HOST
                      </span>
                    )}
                  </li>
                )
              })}
            </ul>
          </section>
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
