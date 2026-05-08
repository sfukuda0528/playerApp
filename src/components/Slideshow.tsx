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
  }, [photos.length])

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

  return (
    <div ref={containerRef} aria-label="スライドショー" className="relative w-full aspect-video rounded-xl overflow-hidden bg-camp-wheat/40">
      {currentUrl && (
        <img
          src={currentUrl}
          alt={`スライド ${safeIndex + 1}`}
          className="w-full h-full object-contain"
        />
      )}
      <div className="absolute bottom-2 right-2 flex items-center gap-1">
        <span className="bg-camp-dark/60 text-camp-cream text-xs px-2 py-0.5 rounded-full">
          {safeIndex + 1} / {photos.length}
        </span>
        {fullscreenEnabled && (
          <button
            aria-label="全画面表示"
            onClick={handleFullscreen}
            className="bg-camp-dark/60 text-camp-cream rounded-md w-6 h-6 flex items-center justify-center text-sm leading-none"
          >
            ⛶
          </button>
        )}
      </div>
    </div>
  )
}
