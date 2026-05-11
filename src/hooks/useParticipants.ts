import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Participant } from '../types/session'

export function useParticipants(
  sessionId: string,
  options?: { onInsert?: (participant: Participant) => void }
) {
  const [participants, setParticipants] = useState<Participant[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<unknown>(null)
  const onInsertRef = useRef(options?.onInsert)
  useEffect(() => { onInsertRef.current = options?.onInsert })

  const removeParticipant = useCallback((participantId: string) => {
    setParticipants((prev) => prev.filter((p) => p.id !== participantId))
  }, [])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)

    supabase
      .from('participants')
      .select()
      .eq('session_id', sessionId)
      .then(({ data, error }) => {
        if (cancelled) return
        setLoading(false)
        if (error) {
          setError(error)
          console.error('Failed to fetch participants:', error)
          return
        }
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
          const newParticipant = payload.new as Participant
          setParticipants((prev) => [...prev, newParticipant])
          onInsertRef.current?.(newParticipant)
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
          removeParticipant(payload.old.id)
        }
      )
      .subscribe()

    return () => {
      cancelled = true
      supabase.removeChannel(channel)
    }
  }, [sessionId, removeParticipant])

  return { participants, loading, error, removeParticipant }
}
