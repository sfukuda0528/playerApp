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

  return (
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
                onClick={() => deletePhoto(photo.id, photo.storage_path)}
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
  )
}
