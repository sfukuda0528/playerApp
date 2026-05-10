import YouTube from 'react-youtube'
import { useEffect, useRef } from 'react'

interface Props {
  videoId?: string
  playlistId?: string
  isPlaying: boolean
  onPlayToggle: () => void
  onEnded: () => void
  onError?: () => void
  onPrev: () => void
  onNext: () => void
  hasPrev: boolean
  hasNext: boolean
}

export default function YouTubePlayer({
  videoId, playlistId, isPlaying, onPlayToggle, onEnded, onError, onPrev, onNext, hasPrev, hasNext,
}: Props) {
  const playerRef = useRef<{ playVideo: () => void; pauseVideo: () => void } | null>(null)

  useEffect(() => {
    const p = playerRef.current
    if (!p) return
    if (isPlaying) {
      p.playVideo()
    } else {
      p.pauseVideo()
    }
  }, [isPlaying])

  const playerVars = playlistId
    ? { autoplay: 0, list: playlistId, listType: 'playlist' as const }
    : { autoplay: 0 }

  return (
    <div>
      <YouTube
        videoId={videoId ?? ''}
        opts={{ width: '200', height: '113', playerVars }}
        onReady={(event) => {
          playerRef.current = event.target as { playVideo: () => void; pauseVideo: () => void }
          if (isPlaying) event.target.playVideo()
        }}
        onEnd={onEnded}
        onError={onError}
      />
      <div>
        <button onClick={onPrev} disabled={!hasPrev} aria-label="前へ">◀</button>
        <button onClick={onPlayToggle} aria-label={isPlaying ? '停止' : '再生'}>
          {isPlaying ? '⏸' : '▶'}
        </button>
        <button onClick={onNext} disabled={!hasNext} aria-label="次へ">▶▶</button>
      </div>
    </div>
  )
}
