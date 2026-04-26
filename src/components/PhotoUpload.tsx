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

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    await upload(sessionId, file)
    e.target.value = ''
  }

  const myPhotos = photos.filter((p) => p.uploader_auth_id === currentUserId)

  return (
    <div>
      <label>
        写真を追加
        <input
          type="file"
          accept="image/*"
          aria-label="写真を追加"
          onChange={handleFileChange}
          disabled={loading}
        />
      </label>
      {error && <p role="alert">{error}</p>}
      {myPhotos.length > 0 && (
        <ul>
          {myPhotos.map((photo) => {
            const { data: { publicUrl } } = supabase.storage.from('photos').getPublicUrl(photo.storage_path)
            return (
              <li key={photo.id}>
                <img src={publicUrl} alt="アップロード済み写真" style={{ width: 80, height: 80, objectFit: 'cover' }} />
                <button
                  aria-label="削除"
                  onClick={() => deletePhoto(photo.id, photo.storage_path)}
                  disabled={loading}
                >
                  削除
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
