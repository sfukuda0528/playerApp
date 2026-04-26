import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Photo } from '../types/session'

export function usePhotos(sessionId: string) {
  const [photos, setPhotos] = useState<Photo[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    supabase
      .from('photos')
      .select()
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true })
      .then(({ data, error: fetchError }) => {
        if (cancelled) return
        if (fetchError) { setError(fetchError.message); return }
        if (data) setPhotos(data as Photo[])
        setLoading(false)
      })

    const channel = supabase
      .channel(`photos:${sessionId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'photos', filter: `session_id=eq.${sessionId}` },
        (payload) => setPhotos((prev) => [...prev, payload.new as Photo])
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'photos', filter: `session_id=eq.${sessionId}` },
        (payload) => setPhotos((prev) => prev.filter((p) => p.id !== (payload.old as Photo).id))
      )
      .subscribe()

    return () => {
      cancelled = true
      supabase.removeChannel(channel)
    }
  }, [sessionId])

  return { photos, loading, error }
}
