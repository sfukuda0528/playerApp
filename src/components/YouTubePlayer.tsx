import YouTube from 'react-youtube'
import { useCallback, useEffect, useRef } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faBackwardStep, faForwardStep, faPlay, faPause } from '@fortawesome/free-solid-svg-icons'

const YOUTUBE_PLAYER_STATE_ENDED = 0

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
  const playerRef = useRef<{
    playVideo: () => void
    pauseVideo: () => void
    getPlayerState?: () => number
  } | null>(null)
  const endedReportedRef = useRef(false)

  useEffect(() => {
    endedReportedRef.current = false
  }, [videoId, playlistId])

  const reportEnded = useCallback(() => {
    if (endedReportedRef.current) return
    endedReportedRef.current = true
    onEnded()
  }, [onEnded])

  useEffect(() => {
    const p = playerRef.current
    if (!p) return
    if (isPlaying) {
      p.playVideo()
    } else {
      p.pauseVideo()
    }
  }, [isPlaying])

  useEffect(() => {
    if (!isPlaying) return

    const checkEndedOnResume = () => {
      const state = playerRef.current?.getPlayerState?.()
      if (state === YOUTUBE_PLAYER_STATE_ENDED) reportEnded()
    }

    document.addEventListener('visibilitychange', checkEndedOnResume)
    window.addEventListener('focus', checkEndedOnResume)
    window.addEventListener('pageshow', checkEndedOnResume)

    return () => {
      document.removeEventListener('visibilitychange', checkEndedOnResume)
      window.removeEventListener('focus', checkEndedOnResume)
      window.removeEventListener('pageshow', checkEndedOnResume)
    }
  }, [isPlaying, reportEnded])

  const playerVars = playlistId
    ? { autoplay: isPlaying ? 1 : 0, playsinline: 1, list: playlistId, listType: 'playlist' as const }
    : { autoplay: isPlaying ? 1 : 0, playsinline: 1 }

  return (
    <div className="flex flex-col gap-3 items-center">
      <YouTube
        videoId={videoId ?? ''}
        opts={{ width: '200', height: '113', playerVars }}
        onReady={(event) => {
          playerRef.current = event.target as { playVideo: () => void; pauseVideo: () => void; getPlayerState?: () => number }
          if (isPlaying) event.target.playVideo()
        }}
        onEnd={reportEnded}
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
