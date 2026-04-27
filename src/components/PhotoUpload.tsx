import { useState, useMemo, useEffect } from 'react'
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
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({})

  const myPhotos = useMemo(
    () => photos.filter((p) => p.uploader_auth_id === currentUserId),
    [photos, currentUserId]
  )

  useEffect(() => {
    if (myPhotos.length === 0) { setSignedUrls({}); return }
    Promise.all(
      myPhotos.map((photo) =>
        supabase.storage
          .from('photos')
          .createSignedUrl(photo.storage_path, 3600)
          .then(({ data }) => [photo.id, data?.signedUrl ?? ''] as [string, string])
      )
    ).then((entries) => setSignedUrls(Object.fromEntries(entries)))
  }, [myPhotos])

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
