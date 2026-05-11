import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { normalizeMusicUrl } from '../utils/youtube'
import type { MusicLink } from '../types/session'

const ALLOWED: RegExp[] = [
  /^https?:\/\/(www\.)?youtube\.com\/watch/,
  /^https?:\/\/youtu\.be\//,
  /^https?:\/\/(www\.)?youtube\.com\/playlist/,
]

export function isValidMusicUrl(url: string): boolean {
  return ALLOWED.some((re) => re.test(url))
}

export function useAddMusicLink() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const addLink = async (
    sessionId: string,
    url: string,
    title: string,
    position: 'head' | 'tail',
    customSortOrder?: number
  ): Promise<boolean> => {
    setError(null)
    const normalized = normalizeMusicUrl(url)
    if (!isValidMusicUrl(normalized)) {
      setError('YouTube または YouTube Music の URL を入力してください')
      return false
    }
    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('認証が必要です')

      let newSortOrder: number
      if (customSortOrder !== undefined) {
        newSortOrder = customSortOrder
      } else {
        const { data: extremeLink } = await supabase
          .from('music_links')
          .select('sort_order')
          .eq('session_id', sessionId)
          .order('sort_order', { ascending: position === 'head' })
          .limit(1)
          .maybeSingle()

        newSortOrder = extremeLink
          ? (position === 'tail' ? extremeLink.sort_order + 1000 : extremeLink.sort_order - 1000)
          : 0
      }

      const { error: insertError } = await supabase
        .from('music_links')
        .insert({
          session_id: sessionId,
          added_by_auth_id: user.id,
          url: normalized,
          title,
          sort_order: newSortOrder,
        })
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

  const addLinks = async (
    sessionId: string,
    items: { url: string; title: string }[],
    position: 'head' | 'tail',
    currentLink?: MusicLink,
    nextLink?: MusicLink
  ): Promise<boolean> => {
    if (items.length === 0) return false
    setError(null)
    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('認証が必要です')

      let baseSortOrder: number
      let step: number

      if (position === 'head' && currentLink) {
        baseSortOrder = currentLink.sort_order
        step = nextLink
          ? (nextLink.sort_order - currentLink.sort_order) / (items.length + 1)
          : 1000
      } else {
        // position='tail', or position='head' without a current song (treated as tail)
        const { data: extremeLink } = await supabase
          .from('music_links')
          .select('sort_order')
          .eq('session_id', sessionId)
          .order('sort_order', { ascending: false })
          .limit(1)
          .maybeSingle()
        baseSortOrder = extremeLink ? extremeLink.sort_order : -1000
        step = 1000
      }

      const rows = items.map((item, i) => ({
        session_id: sessionId,
        added_by_auth_id: user.id,
        url: normalizeMusicUrl(item.url),
        title: item.title,
        sort_order: baseSortOrder + step * (i + 1),
      }))

      const { error: insertError } = await supabase.from('music_links').insert(rows)
      if (insertError) throw insertError

      return true
    } catch (err) {
      setError(err instanceof Error ? err.message : '追加に失敗しました')
      return false
    } finally {
      setLoading(false)
    }
  }

  return { addLink, addLinks, deleteLink, loading, error }
}
