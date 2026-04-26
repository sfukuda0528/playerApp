import { useEffect, useState } from 'react'
import QRCode from 'qrcode'
import { useParticipants } from '../hooks/useParticipants'

interface Props {
  sessionId: string
  code: string
  onClose: () => void
}

export default function JoinOverlay({ sessionId, code, onClose }: Props) {
  const [qrUrl, setQrUrl] = useState('')
  const { participants } = useParticipants(sessionId)
  const joinUrl = `${window.location.origin}/join/${code}`

  useEffect(() => {
    QRCode.toDataURL(joinUrl).then(setQrUrl)
  }, [joinUrl])

  return (
    <div role="dialog" aria-label="メンバー追加">
      <h2>メンバーを追加</h2>
      {qrUrl && <img src={qrUrl} alt="QR Code" />}
      <p>{code}</p>
      <p>{participants.length} / 4 人参加中</p>
      <button onClick={onClose}>閉じる</button>
    </div>
  )
}
