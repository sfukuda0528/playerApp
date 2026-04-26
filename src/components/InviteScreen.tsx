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
  const { participants } = useParticipants(sessionId ?? '')

  const joinUrl = `${window.location.origin}/join/${session?.code}`

  useEffect(() => {
    if (session?.code) {
      QRCode.toDataURL(joinUrl).then(setQrUrl).catch(console.error)
    }
  }, [joinUrl])

  if (!sessionId) return null

  return (
    <div>
      <h2>メンバーを招待</h2>
      {qrUrl && <img src={qrUrl} alt="QR Code" />}
      <p>{session?.code}</p>
      <p>{participants.length} / 4 人参加中</p>
      <button onClick={() => navigate(`/session/${sessionId}`, { state: { session } })}>
        スタート
      </button>
    </div>
  )
}
