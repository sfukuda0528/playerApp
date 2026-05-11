import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Participant } from '../types/session'

export function useParticipants(sessionId: string) {
  const [participants, setParticipants] = useState<Participant[]>([])

  useEffect(() => {
    let cancelled = false

    supabase
      .from('participants')
      .select()
      .eq('session_id', sessionId)
      .then(({ data, error }) => {
        if (cancelled) return
        if (error) { console.error('Failed to fetch participants:', error); return }
        if (data) setParticipants(data as Participant[])
      })

    const channel = supabase
      .channel(`participants:${sessionId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'participants',
          filter: `session_id=eq.${sessionId}`,
        },
        (payload) => {
          setParticipants((prev) => [...prev, payload.new as Participant])
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'participants',
          filter: `session_id=eq.${sessionId}`,
        },
        (payload) => {
          setParticipants((prev) => prev.filter((p) => p.id !== payload.old.id))
        }
      )
      .subscribe()

    return () => {
      cancelled = true
      supabase.removeChannel(channel)
    }
  }, [sessionId])

  return { participants }
}
