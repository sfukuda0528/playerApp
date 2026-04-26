import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { MusicLink } from '../types/session'

export function useMusicLinks(sessionId: string) {
  const [links, setLinks] = useState<MusicLink[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    supabase
      .from('music_links')
      .select()
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true })
      .then(({ data, error: fetchError }) => {
        if (cancelled) return
        if (fetchError) { setError(fetchError.message); setLoading(false); return }
        if (data) setLinks(data as MusicLink[])
        setLoading(false)
      })

    const channel = supabase
      .channel(`music_links:${sessionId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'music_links', filter: `session_id=eq.${sessionId}` },
        (payload) => setLinks((prev) => [...prev, payload.new as MusicLink])
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'music_links', filter: `session_id=eq.${sessionId}` },
        (payload) => setLinks((prev) => prev.filter((l) => l.id !== (payload.old as MusicLink).id))
      )
      .subscribe()

    return () => {
      cancelled = true
      supabase.removeChannel(channel)
    }
  }, [sessionId])

  return { links, loading, error }
}
