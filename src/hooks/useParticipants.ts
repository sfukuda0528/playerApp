import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Participant } from '../types/session'

export function useParticipants(sessionId: string) {
  const [participants, setParticipants] = useState<Participant[]>([])

  useEffect(() => {
    supabase
      .from('participants')
      .select()
      .eq('session_id', sessionId)
      .then(({ data }) => {
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
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [sessionId])

  return { participants }
}
