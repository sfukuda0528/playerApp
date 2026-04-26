import { useState } from 'react'
import { useMusicLinks } from '../hooks/useMusicLinks'
import { useAddMusicLink } from '../hooks/useAddMusicLink'
import type { MusicLink } from '../types/session'

interface Props {
  sessionId: string
  currentUserId: string
}

export default function MusicPanel({ sessionId, currentUserId }: Props) {
  const { links } = useMusicLinks(sessionId)
  const { addLink, deleteLink, loading, error } = useAddMusicLink()
  const [url, setUrl] = useState('')

  const handleAdd = async () => {
    const ok = await addLink(sessionId, url)
    if (ok) setUrl('')
  }

  return (
    <div>
      <div>
        <input
          type="text"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="YouTube / Spotify URL"
        />
        <button onClick={handleAdd} disabled={loading || !url.trim()}>
          追加
        </button>
      </div>
      {error && <p role="alert">{error}</p>}
      <ul>
        {links.map((link: MusicLink) => (
          <li key={link.id}>
            <a href={link.url} target="_blank" rel="noopener noreferrer">
              {link.url}
            </a>
            {link.added_by_auth_id === currentUserId && (
              <button
                aria-label="削除"
                onClick={() => deleteLink(link.id)}
                disabled={loading}
              >
                削除
              </button>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}
