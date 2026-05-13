import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { MusicPlaybackState } from '../types/session'

export function useMusicPlaybackState(sessionId: string) {
  const [state, setState] = useState<MusicPlaybackState | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    const fetchState = () => {
      supabase
        .from('music_playback_state')
        .select()
        .eq('session_id', sessionId)
        .maybeSingle()
        .then(({ data, error: fetchError }) => {
          if (cancelled) return
          if (fetchError) {
            setError(fetchError.message)
            setLoading(false)
            return
          }
          setState(data ? data as MusicPlaybackState : null)
          setLoading(false)
        })
    }

    const channel = supabase
      .channel(`music_playback_state:${sessionId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'music_playback_state', filter: `session_id=eq.${sessionId}` },
        (payload) => setState(payload.new as MusicPlaybackState)
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'music_playback_state', filter: `session_id=eq.${sessionId}` },
        (payload) => setState(payload.new as MusicPlaybackState)
      )
      .subscribe((status) => {
        if (cancelled) return
        if (status === 'SUBSCRIBED') {
          fetchState()
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          setError('キューの同期に失敗しました')
          setLoading(false)
        }
      })

    return () => {
      cancelled = true
      supabase.removeChannel(channel)
    }
  }, [sessionId])

  const setCurrent = useCallback(async (linkId: string | null, isPlaying: boolean): Promise<boolean> => {
    setError(null)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('認証が必要です')
      const { error: upsertError } = await supabase
        .from('music_playback_state')
        .upsert({
          session_id: sessionId,
          current_music_link_id: linkId,
          is_playing: isPlaying,
          updated_by_auth_id: user.id,
        })
      if (upsertError) throw upsertError
      return true
    } catch (err) {
      setError(err instanceof Error ? err.message : 'キューの同期に失敗しました')
      return false
    }
  }, [sessionId])

  const setPlaying = useCallback(async (isPlaying: boolean): Promise<boolean> => {
    setError(null)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('認証が必要です')
      const { error: updateError } = await supabase
        .from('music_playback_state')
        .update({
          is_playing: isPlaying,
          updated_by_auth_id: user.id,
        })
        .eq('session_id', sessionId)
      if (updateError) throw updateError
      return true
    } catch (err) {
      setError(err instanceof Error ? err.message : 'キューの同期に失敗しました')
      return false
    }
  }, [sessionId])

  return { state, loading, error, setCurrent, setPlaying }
}
