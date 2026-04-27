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
    <div className="flex flex-col h-full">
      <div className="bg-camp-dark px-4 py-4 flex flex-col gap-3">
        {videoId ? (
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
        ) : (
          <p className="text-camp-wheat/60 text-sm text-center py-2">
            曲がキューにありません
          </p>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-2">
        <span className="text-camp-amber text-xs font-bold uppercase tracking-wider">キュー</span>
        <ul className="flex flex-col gap-2">
          {links.map((link, index) => (
            <li
              key={link.id}
              aria-current={index === currentIndex ? true : undefined}
              className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm ${
                index === currentIndex
                  ? 'bg-camp-orange text-white'
                  : 'bg-camp-warm-white border border-camp-wheat text-camp-dark'
              }`}
            >
              <span className="flex-1 truncate">{link.url}</span>
              {link.added_by_auth_id === currentUserId && (
                <button
                  aria-label="削除"
                  onClick={() => handleDelete(link, index)}
                  disabled={loading}
                  className="text-xs opacity-70 hover:opacity-100 flex-shrink-0"
                >
                  ✕
                </button>
              )}
            </li>
          ))}
        </ul>

        <div className="flex gap-2 mt-1">
          <input
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="YouTube URL"
            className="flex-1 bg-camp-cream border border-camp-wheat rounded-lg px-3 py-2 text-sm text-camp-dark outline-none focus:border-camp-orange"
          />
          <button
            onClick={handleAdd}
            disabled={loading || !url.trim()}
            className="bg-camp-orange text-white text-sm font-bold px-3 py-2 rounded-lg disabled:opacity-40"
          >
            追加
          </button>
        </div>
        {error && <p role="alert" className="text-camp-destructive text-xs">{error}</p>}
      </div>
    </div>
  )
}
