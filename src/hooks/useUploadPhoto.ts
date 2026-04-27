import { useState } from 'react'
import { supabase } from '../lib/supabase'

export function useUploadPhoto() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const upload = async (sessionId: string, file: File): Promise<boolean> => {
    setLoading(true)
    setError(null)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('認証が必要です')

      const path = `${sessionId}/${Date.now()}_${file.name}`
      const { error: storageError } = await supabase.storage.from('photos').upload(path, file)
      if (storageError) throw storageError

      const { error: insertError } = await supabase
        .from('photos')
        .insert({ session_id: sessionId, uploader_auth_id: user.id, storage_path: path })
      if (insertError) throw insertError

      return true
    } catch (err) {
      setError(err instanceof Error ? err.message : 'アップロードに失敗しました')
      return false
    } finally {
      setLoading(false)
    }
  }

  const deletePhoto = async (photoId: string, storagePath: string): Promise<boolean> => {
    setLoading(true)
    setError(null)
    try {
      const { error: storageError } = await supabase.storage.from('photos').remove([storagePath])
      if (storageError) throw storageError

      const { error: deleteError } = await supabase.from('photos').delete().eq('id', photoId)
      if (deleteError) throw deleteError

      return true
    } catch (err) {
      setError(err instanceof Error ? err.message : '削除に失敗しました')
      return false
    } finally {
      setLoading(false)
    }
  }

  return { upload, deletePhoto, loading, error }
}
