import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Photo } from '../types/session'

export function usePhotos(
  sessionId: string,
  options?: { onInsert?: (photo: Photo) => void }
) {
  const [photos, setPhotos] = useState<Photo[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const onInsertRef = useRef(options?.onInsert)
  useEffect(() => { onInsertRef.current = options?.onInsert })

  useEffect(() => {
    let cancelled = false

    supabase
      .from('photos')
      .select()
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true })
      .then(({ data, error: fetchError }) => {
        if (cancelled) return
        if (fetchError) { setError(fetchError.message); setLoading(false); return }
        if (data) setPhotos(data as Photo[])
        setLoading(false)
      })

    const channel = supabase
      .channel(`photos:${sessionId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'photos', filter: `session_id=eq.${sessionId}` },
        (payload) => {
          const newPhoto = payload.new as Photo
          setPhotos((prev) => [...prev, newPhoto])
          onInsertRef.current?.(newPhoto)
        }
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
