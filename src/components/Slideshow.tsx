import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import type { Photo } from '../types/session'

interface Props {
  photos: Photo[]
}

export default function Slideshow({ photos }: Props) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [photoUrls, setPhotoUrls] = useState<string[]>([])
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [fullscreenEnabled] = useState(() => document.fullscreenEnabled ?? false)
  const [manualNavCount, setManualNavCount] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)

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
      setCurrentIndex((prev) => (prev + 1) % photos.length)
    }, 5000)
    return () => clearInterval(timer)
  }, [photos.length, manualNavCount])

  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', handler)
    return () => document.removeEventListener('fullscreenchange', handler)
  }, [])

  const handleExitFullscreen = () => {
    document.exitFullscreen().catch(console.error)
  }

  const handlePrev = () => {
    setCurrentIndex((prev) => (prev - 1 + photos.length) % photos.length)
    setManualNavCount((c) => c + 1)
  }

  const handleNext = () => {
    setCurrentIndex((prev) => (prev + 1) % photos.length)
    setManualNavCount((c) => c + 1)
  }

  if (photos.length === 0) {
    return (
      <div
        aria-label="スライドショー"
        className="w-full aspect-video bg-camp-wheat/40 rounded-xl flex items-center justify-center text-camp-amber text-sm"
      >
        写真がまだありません
      </div>
    )
  }

  const safeIndex = currentIndex % photos.length
  const currentUrl = photoUrls[safeIndex]
  const currentPhoto = photos[safeIndex]
  const uploadedTime = currentPhoto
    ? new Intl.DateTimeFormat('ja-JP', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Asia/Tokyo',
    }).format(new Date(currentPhoto.created_at))
    : null

  return (
    <div ref={containerRef} aria-label="スライドショー" className="relative w-full aspect-video rounded-xl overflow-hidden bg-camp-wheat/40">
      {currentUrl && (
        <img
          src={currentUrl}
          alt={`スライド ${safeIndex + 1}`}
          className="w-full h-full object-contain"
        />
      )}
      {isFullscreen && (
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
