import { useState } from 'react'
import { supabase } from '../lib/supabase'

const ALLOWED: RegExp[] = [
  /^https?:\/\/(www\.)?youtube\.com\/watch/,
  /^https?:\/\/youtu\.be\//,
]

export function isValidMusicUrl(url: string): boolean {
  return ALLOWED.some((re) => re.test(url))
}

export function useAddMusicLink() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const addLink = async (sessionId: string, url: string): Promise<boolean> => {
    setError(null)
    if (!isValidMusicUrl(url)) {
      setError('YouTube の URL を入力してください')
      return false
    }
    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('認証が必要です')

      const { error: insertError } = await supabase
        .from('music_links')
        .insert({ session_id: sessionId, added_by_auth_id: user.id, url })
      if (insertError) throw insertError

      return true
    } catch (err) {
      setError(err instanceof Error ? err.message : '追加に失敗しました')
      return false
    } finally {
      setLoading(false)
    }
  }

  const deleteLink = async (linkId: string): Promise<boolean> => {
    setLoading(true)
    setError(null)
    try {
      const { error: deleteError } = await supabase.from('music_links').delete().eq('id', linkId)
      if (deleteError) throw deleteError
      return true
    } catch (err) {
      setError(err instanceof Error ? err.message : '削除に失敗しました')
      return false
    } finally {
      setLoading(false)
    }
  }

  return { addLink, deleteLink, loading, error }
}
