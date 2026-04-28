import { useMemo, useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useUploadPhoto } from '../hooks/useUploadPhoto'
import type { Photo } from '../types/session'

interface Props {
  sessionId: string
  photos: Photo[]
  currentUserId: string
}

export default function PhotoUpload({ sessionId, photos, currentUserId }: Props) {
  const { upload, deletePhoto, loading, error } = useUploadPhoto()
  const [canShare, setCanShare] = useState(false)
  const [sharing, setSharing] = useState(false)

  useEffect(() => {
    if (!navigator.canShare) return
    const testFile = new File([], 'test.jpg', { type: 'image/jpeg' })
    setCanShare(navigator.canShare({ files: [testFile] }))
  }, [])

  const myPhotos = useMemo(
    () => photos.filter((p) => p.uploader_auth_id === currentUserId),
    [photos, currentUserId]
  )

  const signedUrls = useMemo(() => {
    const result: Record<string, string> = {}
    for (const photo of myPhotos) {
      const { data } = supabase.storage.from('photos').getPublicUrl(photo.storage_path)
      result[photo.id] = data.publicUrl
    }
    return result
  }, [myPhotos])

  const allPhotoUrls = useMemo(
    () =>
      photos.map((photo) => {
        const { data } = supabase.storage.from('photos').getPublicUrl(photo.storage_path)
        return { url: data.publicUrl, path: photo.storage_path }
      }),
    [photos]
  )

  const handleSaveAll = async () => {
    setSharing(true)
    try {
      const files = await Promise.all(
        allPhotoUrls.map(async ({ url, path }) => {
          const res = await fetch(url)
          const blob = await res.blob()
          const name = path.split('/').pop() ?? 'photo.jpg'
          return new File([blob], name, { type: blob.type })
        })
      )
      await navigator.share({ files, title: 'CampCanvas 写真' })
    } catch (e) {
      if (e instanceof Error && e.name !== 'AbortError') {
        console.error(e)
      }
    } finally {
      setSharing(false)
    }
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    await upload(sessionId, file)
    e.target.value = ''
  }

  return (
    <div className="flex flex-col gap-3">
      <label className="flex items-center justify-center gap-2 bg-camp-orange text-white font-bold py-2.5 rounded-xl cursor-pointer">
        📷 写真を追加
        <input
          type="file"
          accept="image/*"
          aria-label="写真を追加"
          onChange={handleFileChange}
          disabled={loading}
          className="hidden"
        />
      </label>
      {canShare && photos.length > 0 && (
        <button
          onClick={handleSaveAll}
          disabled={sharing}
          className="flex items-center justify-center gap-2 bg-camp-brown text-camp-cream font-bold py-2.5 rounded-xl disabled:opacity-60"
        >
          {sharing ? '⏳ 読み込み中...' : `💾 全写真を保存（${photos.length}枚）`}
        </button>
      )}
      {error && <p role="alert" className="text-camp-destructive text-xs">{error}</p>}
      {myPhotos.length > 0 && (
        <ul className="grid grid-cols-3 gap-2">
          {myPhotos.map((photo) => (
            <li key={photo.id} className="relative aspect-square">
              <img
                src={signedUrls[photo.id] ?? ''}
                alt="アップロード済み写真"
                className="w-full h-full object-cover rounded-lg"
              />
              <button
                aria-label="削除"
                onClick={() => deletePhoto(photo.id, photo.storage_path)}
                disabled={loading}
                className="absolute top-1 right-1 bg-camp-dark/70 text-camp-cream text-xs w-5 h-5 rounded-full flex items-center justify-center"
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
