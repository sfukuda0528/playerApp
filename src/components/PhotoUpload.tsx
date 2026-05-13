import { useMemo, useState, useEffect } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faCamera, faDownload, faImages, faSpinner } from '@fortawesome/free-solid-svg-icons'
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
  const [uploadProgress, setUploadProgress] = useState<{ current: number; total: number } | null>(null)
  const [photoToDelete, setPhotoToDelete] = useState<Photo | null>(null)

  useEffect(() => {
    if (!navigator.canShare) return
    const testFile = new File([], 'test.jpg', { type: 'image/jpeg' })
    setCanShare(navigator.canShare({ files: [testFile] }))
  }, [])

  const myPhotos = useMemo(
    () => photos.filter((p) => p.uploader_auth_id === currentUserId),
    [photos, currentUserId]
  )

  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({})

  useEffect(() => {
    if (myPhotos.length === 0) { setSignedUrls({}); return }
    Promise.all(
      myPhotos.map(async (photo) => {
        const { data } = await supabase.storage.from('photos').createSignedUrl(photo.storage_path, 3600)
        return [photo.id, data?.signedUrl ?? ''] as const
      })
    ).then((entries) => setSignedUrls(Object.fromEntries(entries)))
  }, [myPhotos])

  const handleSaveAll = async () => {
    setSharing(true)
    try {
      const signedEntries = await Promise.all(
        photos.map(async (photo) => {
          const { data } = await supabase.storage.from('photos').createSignedUrl(photo.storage_path, 3600)
          return { url: data?.signedUrl ?? '', path: photo.storage_path }
        })
      )
      const files = await Promise.all(
        signedEntries.map(async ({ url, path }) => {
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
    const files = Array.from(e.target.files ?? [])
    if (files.length === 0) return

    setUploadProgress({ current: 0, total: files.length })
    try {
      for (const [index, file] of files.entries()) {
        setUploadProgress({ current: index + 1, total: files.length })
        await upload(sessionId, file)
      }
    } finally {
      setUploadProgress(null)
      e.target.value = ''
    }
  }

  const isUploading = uploadProgress !== null
  const busy = loading || isUploading
  const photoToDeleteName = photoToDelete?.storage_path.split('/').pop() ?? photoToDelete?.storage_path

  const handleConfirmDelete = async () => {
    if (!photoToDelete) return
    const ok = await deletePhoto(photoToDelete.id, photoToDelete.storage_path)
    if (ok) setPhotoToDelete(null)
  }

  return (
    <>
      <section
        className="rounded-2xl border border-camp-wheat bg-white p-4 text-camp-brown"
        style={{ boxShadow: '0 8px 22px rgba(124,74,30,0.10)' }}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="flex items-center gap-1.5 text-sm font-black text-camp-dark">
              <FontAwesomeIcon icon={faImages} className="text-camp-orange" />
              自分の写真
            </p>
            <p className="mt-1 text-xs font-bold text-camp-brown/70">全体 {photos.length}枚</p>
          </div>
          <span className="rounded-full bg-camp-wheat/45 px-3 py-1 text-xs font-black text-camp-brown">
            {myPhotos.length}枚
          </span>
        </div>
        <div className="mt-3 flex flex-col gap-2">
          <label className="flex items-center justify-center gap-2 bg-camp-orange text-white font-bold py-2.5 rounded-xl cursor-pointer transition-all duration-150 active:scale-[0.99]">
            <FontAwesomeIcon icon={isUploading ? faSpinner : faCamera} spin={isUploading} />
            {uploadProgress
              ? `${uploadProgress.total}枚中 ${uploadProgress.current}枚アップロード中...`
              : '写真を追加'}
            <input
              type="file"
              accept="image/*"
              multiple
              aria-label="写真を追加"
              onChange={handleFileChange}
              disabled={busy}
              className="hidden"
            />
          </label>
          {canShare && photos.length > 0 && (
            <button
              onClick={handleSaveAll}
              disabled={sharing}
              className="flex items-center justify-center gap-2 bg-camp-brown text-camp-cream font-bold py-2.5 rounded-xl disabled:opacity-60"
            >
              {sharing ? <><FontAwesomeIcon icon={faSpinner} spin /> 読み込み中...</> : <><FontAwesomeIcon icon={faDownload} /> 全写真を保存（{photos.length}枚）</>}
            </button>
          )}
        </div>
        {error && <p role="alert" className="mt-3 text-camp-destructive text-xs">{error}</p>}
        {myPhotos.length > 0 && (
          <ul className="mt-3 grid grid-cols-3 gap-2">
            {myPhotos.map((photo) => (
              <li key={photo.id} className="relative aspect-square">
                {signedUrls[photo.id] && (
                  <img
                    src={signedUrls[photo.id]}
                    alt="アップロード済み写真"
                    className="w-full h-full object-cover rounded-lg"
                  />
                )}
                <button
                  aria-label="削除"
                  onClick={() => setPhotoToDelete(photo)}
                  disabled={busy}
                  className="absolute top-1 right-1 bg-camp-dark/70 text-camp-cream text-xs w-5 h-5 rounded-full flex items-center justify-center"
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {photoToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 px-4 py-5">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="photo-delete-dialog-title"
            className="w-full max-w-sm rounded-xl bg-white p-4 shadow-2xl"
          >
            <h2 id="photo-delete-dialog-title" className="text-base font-black text-camp-dark">
              写真を削除しますか？
            </h2>
            <div className="mt-3 flex gap-3">
              {signedUrls[photoToDelete.id] && (
                <img
                  src={signedUrls[photoToDelete.id]}
                  alt="削除対象の写真"
                  className="h-20 w-20 rounded-lg object-cover"
                />
              )}
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-camp-dark truncate">{photoToDeleteName}</p>
                <p className="mt-1 text-xs text-camp-brown/60 break-all">{photoToDelete.storage_path}</p>
              </div>
            </div>
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={() => setPhotoToDelete(null)}
                disabled={loading}
                className="flex-1 rounded-xl bg-camp-wheat/45 px-3 py-2 text-sm font-bold text-camp-brown disabled:opacity-60"
              >
                キャンセル
              </button>
              <button
                type="button"
                onClick={() => void handleConfirmDelete()}
                disabled={loading}
                className="flex-1 rounded-xl bg-camp-destructive px-3 py-2 text-sm font-bold text-white disabled:opacity-60"
              >
                削除する
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
