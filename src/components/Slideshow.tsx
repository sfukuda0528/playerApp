import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import type { Photo } from '../types/session'

interface Props {
  photos: Photo[]
}

export default function Slideshow({ photos }: Props) {
  const [currentIndex, setCurrentIndex] = useState(0)

  useEffect(() => {
    if (photos.length === 0) return
    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % photos.length)
    }, 5000)
    return () => clearInterval(timer)
  }, [photos.length])

  if (photos.length === 0) {
    return <div aria-label="スライドショー">写真がまだありません</div>
  }

  const photo = photos[currentIndex]
  const { data: { publicUrl } } = supabase.storage.from('photos').getPublicUrl(photo.storage_path)

  return (
    <div aria-label="スライドショー">
      <img src={publicUrl} alt={`スライド ${currentIndex + 1}`} />
      <span>{currentIndex + 1} / {photos.length}</span>
    </div>
  )
}
