import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import type { Photo } from '../types/session'

interface Props {
  photos: Photo[]
}

const SLIDE_INTERVAL_OPTIONS = [
  { value: 3000, label: '3秒' },
  { value: 5000, label: '5秒' },
  { value: 8000, label: '8秒' },
  { value: 10000, label: '10秒' },
]

const FADE_DURATION_MS = 500
const FULLSCREEN_UI_HIDE_DELAY_MS = 3000
const SLIDESHOW_BACKGROUND_STYLE = {
  background: 'linear-gradient(135deg, rgba(253, 246, 236, 0.72), rgba(240, 200, 150, 0.48), rgba(224, 123, 57, 0.12))',
}

interface SlideState {
  currentIndex: number
  exitingIndex: number | null
}

export function getNextSlideState(previous: SlideState, nextIndex: number): SlideState {
  if (previous.currentIndex === nextIndex) {
    return { currentIndex: nextIndex, exitingIndex: null }
  }

  return { currentIndex: nextIndex, exitingIndex: previous.currentIndex }
}

export default function Slideshow({ photos }: Props) {
  const [slideState, setSlideState] = useState<SlideState>({ currentIndex: 0, exitingIndex: null })
  const [photoUrls, setPhotoUrls] = useState<string[]>([])
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [fullscreenEnabled] = useState(() => document.fullscreenEnabled ?? false)
  const [manualNavCount, setManualNavCount] = useState(0)
  const [slideIntervalMs, setSlideIntervalMs] = useState(5000)
  const [isFullscreenUiVisible, setIsFullscreenUiVisible] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const fullscreenUiTimerRef = useRef<number | null>(null)

  const clearFullscreenUiTimer = () => {
    if (fullscreenUiTimerRef.current === null) return
    window.clearTimeout(fullscreenUiTimerRef.current)
    fullscreenUiTimerRef.current = null
  }

  const showFullscreenUi = () => {
    if (!isFullscreen) return
    setIsFullscreenUiVisible(true)
    clearFullscreenUiTimer()
    fullscreenUiTimerRef.current = window.setTimeout(() => {
      setIsFullscreenUiVisible(false)
      fullscreenUiTimerRef.current = null
    }, FULLSCREEN_UI_HIDE_DELAY_MS)
  }

  const handleFullscreen = () => {
    containerRef.current?.requestFullscreen().catch(console.error)
  }

  useEffect(() => {
    if (photos.length === 0) { setPhotoUrls([]); return }
    Promise.all(
      photos.map(async (photo) => {
        const { data } = await supabase.storage.from('photos').createSignedUrl(photo.storage_path, 3600)
        return data?.signedUrl ?? ''
      })
    ).then(setPhotoUrls)
  }, [photos])

  useEffect(() => {
    if (photos.length === 0) return
    const timer = setInterval(() => {
      setSlideState((prev) => getNextSlideState(prev, (prev.currentIndex + 1) % photos.length))
    }, slideIntervalMs)
    return () => clearInterval(timer)
  }, [photos.length, manualNavCount, slideIntervalMs])

  useEffect(() => {
    if (photos.length === 0) {
      setSlideState({ currentIndex: 0, exitingIndex: null })
      return
    }

    setSlideState((prev) => {
      if (prev.currentIndex < photos.length && (prev.exitingIndex === null || prev.exitingIndex < photos.length)) {
        return prev
      }

      return {
        currentIndex: prev.currentIndex % photos.length,
        exitingIndex: null,
      }
    })
  }, [photos.length])

  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', handler)
    return () => document.removeEventListener('fullscreenchange', handler)
  }, [])

  useEffect(() => {
    clearFullscreenUiTimer()
    setIsFullscreenUiVisible(false)
  }, [isFullscreen])

  useEffect(() => clearFullscreenUiTimer, [])

  const handleExitFullscreen = () => {
    document.exitFullscreen().catch(console.error)
  }

  const handlePrev = () => {
    setSlideState((prev) => getNextSlideState(prev, (prev.currentIndex - 1 + photos.length) % photos.length))
    setManualNavCount((c) => c + 1)
  }

  const handleNext = () => {
    setSlideState((prev) => getNextSlideState(prev, (prev.currentIndex + 1) % photos.length))
    setManualNavCount((c) => c + 1)
  }

  const safeIndex = photos.length > 0 ? slideState.currentIndex % photos.length : 0
  const currentUrl = photoUrls[safeIndex]
  const exitingUrl = slideState.exitingIndex === null ? null : photoUrls[slideState.exitingIndex]

  useEffect(() => {
    if (slideState.exitingIndex === null) return
    const fadeTimer = window.setTimeout(() => {
      setSlideState((prev) => ({ ...prev, exitingIndex: null }))
    }, FADE_DURATION_MS)
    return () => window.clearTimeout(fadeTimer)
  }, [slideState.exitingIndex])

  const speedSelect = (
    <>
      <label htmlFor="slideshow-interval" className="sr-only">写真送り速度</label>
      <select
        id="slideshow-interval"
        value={slideIntervalMs}
        onChange={(event) => setSlideIntervalMs(Number(event.target.value))}
        className="bg-camp-dark/60 text-camp-cream text-xs px-2 py-0.5 rounded-full font-bold"
      >
        {SLIDE_INTERVAL_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </>
  )

  if (photos.length === 0) {
    return (
      <div
        aria-label="スライドショー"
        className="w-full aspect-video bg-camp-wheat/40 rounded-xl flex items-center justify-center text-camp-amber text-sm"
        style={SLIDESHOW_BACKGROUND_STYLE}
      >
        写真がまだありません
      </div>
    )
  }

  const currentPhoto = photos[safeIndex]
  const uploadedTime = currentPhoto
    ? new Intl.DateTimeFormat('ja-JP', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Asia/Tokyo',
    }).format(new Date(currentPhoto.created_at))
    : null

  return (
    <div
      ref={containerRef}
      aria-label="スライドショー"
      onMouseMove={showFullscreenUi}
      onTouchStart={showFullscreenUi}
      onClick={showFullscreenUi}
      className="relative w-full aspect-video rounded-xl overflow-hidden bg-camp-wheat/40"
      style={SLIDESHOW_BACKGROUND_STYLE}
    >
      {exitingUrl && (
        <img
          src={exitingUrl}
          alt=""
          aria-hidden="true"
          className="absolute inset-0 w-full h-full object-contain animate-photo-fade-out"
        />
      )}
      {currentUrl && (
        <img
          key={currentUrl}
          src={currentUrl}
          alt={`スライド ${safeIndex + 1}`}
          className="absolute inset-0 w-full h-full object-contain animate-photo-crossfade"
        />
      )}
      {isFullscreen && isFullscreenUiVisible && (
        <>
          <button
            type="button"
            aria-label="全画面を閉じる"
            onClick={handleExitFullscreen}
            className="absolute top-2 right-2 bg-black/60 text-white rounded-md w-8 h-8 flex items-center justify-center text-base leading-none"
          >
            ✕
          </button>
          <div className="absolute top-2 left-2 flex flex-wrap items-center gap-1">
            {speedSelect}
            <span className="bg-black/60 text-white text-xs px-2 py-0.5 rounded-full">
              {safeIndex + 1} / {photos.length}
            </span>
            {uploadedTime && (
              <span className="bg-black/60 text-white text-xs px-2 py-0.5 rounded-full">
                {uploadedTime} にアップロード
              </span>
            )}
          </div>
          <button
            type="button"
            aria-label="前の写真"
            onClick={handlePrev}
            className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/50 text-white rounded-full w-9 h-9 flex items-center justify-center text-lg leading-none"
          >
            ‹
          </button>
          <button
            type="button"
            aria-label="次の写真"
            onClick={handleNext}
            className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/50 text-white rounded-full w-9 h-9 flex items-center justify-center text-lg leading-none"
          >
            ›
          </button>
          <span className="absolute bottom-3 left-0 right-0 text-center text-white/40 text-xs">
            自動スライド継続中
          </span>
        </>
      )}
      {!isFullscreen && (
        <div className="absolute bottom-2 right-2 flex flex-wrap items-center justify-end gap-1">
          {speedSelect}
          {uploadedTime && (
            <span className="bg-camp-dark/60 text-camp-cream text-xs px-2 py-0.5 rounded-full">
              {uploadedTime} にアップロード
            </span>
          )}
          <span className="bg-camp-dark/60 text-camp-cream text-xs px-2 py-0.5 rounded-full">
            {safeIndex + 1} / {photos.length}
          </span>
          {fullscreenEnabled && (
            <button
              type="button"
              aria-label="全画面表示"
              onClick={handleFullscreen}
              className="bg-camp-dark/60 text-camp-cream rounded-md w-6 h-6 flex items-center justify-center text-sm leading-none"
            >
              ⛶
            </button>
          )}
        </div>
      )}
    </div>
  )
}
