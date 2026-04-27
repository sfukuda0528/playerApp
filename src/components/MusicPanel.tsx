import { useEffect, useState } from 'react'
import { useMusicLinks } from '../hooks/useMusicLinks'
import { useAddMusicLink } from '../hooks/useAddMusicLink'
import YouTubePlayer from './YouTubePlayer'
import { extractYouTubeId } from '../utils/youtube'
import type { MusicLink } from '../types/session'

interface Props {
  sessionId: string
  currentUserId: string
}

export default function MusicPanel({ sessionId, currentUserId }: Props) {
  const { links } = useMusicLinks(sessionId)
  const { addLink, deleteLink, loading, error } = useAddMusicLink()
  const [url, setUrl] = useState('')
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [restartKey, setRestartKey] = useState(0)

  useEffect(() => {
    if (links.length === 0 || currentIndex >= links.length) {
      setIsPlaying(false)
      setCurrentIndex(0)
    }
  }, [links.length, currentIndex])

  const handleAdd = async () => {
    const ok = await addLink(sessionId, url)
    if (ok) setUrl('')
  }

  const handleDelete = async (link: MusicLink, index: number) => {
    const isCurrent = index === currentIndex
    const ok = await deleteLink(link.id)
    if (!ok) return
    if (isCurrent) {
      setIsPlaying(false)
      setCurrentIndex(0)
    } else if (index < currentIndex) {
      setCurrentIndex((prev) => prev - 1)
    }
  }

  const handleEnded = () => {
    setCurrentIndex((prev) => (prev + 1) % links.length)
    setRestartKey((k) => k + 1)
  }

  const currentLink = links[currentIndex]
  const videoId = currentLink ? extractYouTubeId(currentLink.url) : null

  return (
    <div>
      {videoId && (
        <YouTubePlayer
          key={`${currentIndex}-${restartKey}`}
          videoId={videoId}
          isPlaying={isPlaying}
          onPlayToggle={() => setIsPlaying((p) => !p)}
          onEnded={handleEnded}
          onPrev={() => setCurrentIndex((prev) => (prev - 1 + links.length) % links.length)}
          onNext={() => setCurrentIndex((prev) => (prev + 1) % links.length)}
          hasPrev={links.length > 1}
          hasNext={links.length > 1}
        />
      )}
      <div>
        <input
          type="text"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="YouTube URL"
        />
        <button onClick={handleAdd} disabled={loading || !url.trim()}>
          追加
        </button>
      </div>
      {error && <p role="alert">{error}</p>}
      <ul>
        {links.map((link, index) => (
          <li key={link.id} aria-current={index === currentIndex ? true : undefined}>
            {link.url}
            {link.added_by_auth_id === currentUserId && (
              <button
                aria-label="削除"
                onClick={() => handleDelete(link, index)}
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
