import YouTube from 'react-youtube'
import { useEffect, useRef, useState } from 'react'

interface Props {
  videoId: string
  isPlaying: boolean
  onPlayToggle: () => void
  onEnded: () => void
  onPrev: () => void
  onNext: () => void
  hasPrev: boolean
  hasNext: boolean
}

export default function YouTubePlayer({
  videoId, isPlaying, onPlayToggle, onEnded, onPrev, onNext, hasPrev, hasNext,
}: Props) {
  const playerRef = useRef<{ playVideo: () => void; pauseVideo: () => void } | null>(null)
  const [playerError, setPlayerError] = useState(false)

  useEffect(() => {
    const p = playerRef.current
    if (!p) return
    if (isPlaying) {
      p.playVideo()
    } else {
      p.pauseVideo()
    }
  }, [isPlaying])

  return (
    <div>
      <YouTube
        videoId={videoId}
        opts={{ width: '200', height: '113', playerVars: { autoplay: 0 } }}
        onReady={(event) => {
          playerRef.current = event.target as { playVideo: () => void; pauseVideo: () => void }
        }}
        onEnd={onEnded}
        onError={() => setPlayerError(true)}
      />
      {playerError && <p role="alert">再生できません</p>}
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
