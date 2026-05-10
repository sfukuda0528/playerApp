import YouTube from 'react-youtube'
import { useEffect, useRef } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faBackwardStep, faForwardStep, faPlay, faPause } from '@fortawesome/free-solid-svg-icons'

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
    <div className="flex flex-col gap-3">
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
      <div className="flex justify-center items-center gap-5">
        <button
          onClick={onPrev}
          disabled={!hasPrev}
          aria-label="前へ"
          className="text-camp-cream/40 disabled:opacity-20 active:scale-90 transition-all duration-150"
        >
          <FontAwesomeIcon icon={faBackwardStep} className="text-xl" />
        </button>
        <button
          onClick={onPlayToggle}
          aria-label={isPlaying ? '停止' : '再生'}
          className="w-11 h-11 rounded-full flex items-center justify-center active:scale-90 transition-all duration-150"
          style={{
            background: 'linear-gradient(135deg, #e07b39, #c8601a)',
            boxShadow: '0 4px 14px rgba(224,123,57,0.55)',
          }}
        >
          <FontAwesomeIcon icon={isPlaying ? faPause : faPlay} className="text-white" />
        </button>
        <button
          onClick={onNext}
          disabled={!hasNext}
          aria-label="次へ"
          className="text-camp-cream/40 disabled:opacity-20 active:scale-90 transition-all duration-150"
        >
          <FontAwesomeIcon icon={faForwardStep} className="text-xl" />
        </button>
      </div>
    </div>
  )
}
