import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { MusicLink } from '../types/session'

function sortByQueueOrder(links: MusicLink[]) {
  return [...links].sort((a, b) => a.sort_order - b.sort_order)
}

function mergeLinks(...groups: MusicLink[][]) {
  const byId = new Map<string, MusicLink>()
  for (const group of groups) {
    for (const link of group) byId.set(link.id, link)
  }
  return sortByQueueOrder(Array.from(byId.values()))
}

export function useMusicLinks(
  sessionId: string,
  options?: {
    onInsert?: (link: MusicLink, prevLinks: MusicLink[]) => void
    onUpdate?: (prevLinks: MusicLink[], newLinks: MusicLink[]) => void
  }
) {
  const [links, setLinks] = useState<MusicLink[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const onInsertRef = useRef(options?.onInsert)
  const onUpdateRef = useRef(options?.onUpdate)
  useEffect(() => { onInsertRef.current = options?.onInsert })
  useEffect(() => { onUpdateRef.current = options?.onUpdate })

  const linksRef = useRef<MusicLink[]>([])
  useEffect(() => { linksRef.current = links }, [links])

  useEffect(() => {
    let cancelled = false

    const fetchLinks = () => {
      supabase
        .from('music_links')
        .select()
        .eq('session_id', sessionId)
        .order('sort_order', { ascending: true })
        .then(({ data, error: fetchError }) => {
          if (cancelled) return
          if (fetchError) { setError(fetchError.message); setLoading(false); return }
          setLinks((prev) => mergeLinks(data ? data as MusicLink[] : [], prev))
          setLoading(false)
        })
    }

    const channel = supabase
      .channel(`music_links:${sessionId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'music_links', filter: `session_id=eq.${sessionId}` },
        (payload) => {
          const newLink = payload.new as MusicLink
          const prevLinks = linksRef.current
          setLinks((prev) => {
            if (prev.some((link) => link.id === newLink.id)) return prev
            return mergeLinks(prev, [newLink])
          })
          if (!prevLinks.some((link) => link.id === newLink.id)) {
            onInsertRef.current?.(newLink, prevLinks)
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'music_links', filter: `session_id=eq.${sessionId}` },
        (payload) => {
          const updated = payload.new as MusicLink
          const prevLinks = linksRef.current
          const newLinks = mergeLinks(prevLinks.map(l => l.id === updated.id ? updated : l))
          setLinks(newLinks)
          onUpdateRef.current?.(prevLinks, newLinks)
        }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'music_links', filter: `session_id=eq.${sessionId}` },
        (payload) => setLinks((prev) => prev.filter((l) => l.id !== (payload.old as MusicLink).id))
      )
      .subscribe((status) => {
        if (cancelled) return
        if (status === 'SUBSCRIBED') {
          fetchLinks()
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

  const optimisticReorder = (sorted: MusicLink[]) => setLinks(sorted)

  return { links, loading, error, optimisticReorder }
}
