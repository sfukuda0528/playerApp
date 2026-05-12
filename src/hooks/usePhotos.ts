import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Photo } from '../types/session'

function sortByCreatedAt(photos: Photo[]) {
  return [...photos].sort((a, b) => a.created_at.localeCompare(b.created_at))
}

function mergePhotos(...groups: Photo[][]) {
  const byId = new Map<string, Photo>()
  for (const group of groups) {
    for (const photo of group) byId.set(photo.id, photo)
  }
  return sortByCreatedAt(Array.from(byId.values()))
}

export function usePhotos(
  sessionId: string,
  options?: { onInsert?: (photo: Photo) => void }
) {
  const [photos, setPhotos] = useState<Photo[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const onInsertRef = useRef(options?.onInsert)
  useEffect(() => { onInsertRef.current = options?.onInsert })
  const photosRef = useRef<Photo[]>([])
  useEffect(() => { photosRef.current = photos }, [photos])

  useEffect(() => {
    let cancelled = false
    const deletedPhotoIds = new Set<string>()
    setLoading(true)
    setError(null)

    const fetchPhotos = () => {
      supabase
        .from('photos')
        .select()
        .eq('session_id', sessionId)
        .order('created_at', { ascending: true })
        .then(({ data, error: fetchError }) => {
          if (cancelled) return
          if (fetchError) { setError(fetchError.message); setLoading(false); return }
          const fetchedPhotos = data ? data as Photo[] : []
          setPhotos((prev) =>
            mergePhotos(fetchedPhotos, prev)
              .filter((photo) => !deletedPhotoIds.has(photo.id))
          )
          setLoading(false)
        })
    }

    const channel = supabase
      .channel(`photos:${sessionId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'photos', filter: `session_id=eq.${sessionId}` },
        (payload) => {
          const newPhoto = payload.new as Photo
          const prevPhotos = photosRef.current
          setPhotos((prev) => {
            if (prev.some((photo) => photo.id === newPhoto.id)) return prev
            return mergePhotos(prev, [newPhoto])
          })
          if (!prevPhotos.some((photo) => photo.id === newPhoto.id)) {
            onInsertRef.current?.(newPhoto)
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'photos', filter: `session_id=eq.${sessionId}` },
        (payload) => {
          const deletedPhoto = payload.old as Photo
          deletedPhotoIds.add(deletedPhoto.id)
          setPhotos((prev) => prev.filter((p) => p.id !== deletedPhoto.id))
        }
      )
      .subscribe((status) => {
        if (cancelled) return
        if (status === 'SUBSCRIBED') {
          fetchPhotos()
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          setError('写真の同期に失敗しました')
          setLoading(false)
        }
      })

    return () => {
      cancelled = true
      supabase.removeChannel(channel)
    }
  }, [sessionId])

  return { photos, loading, error }
}
