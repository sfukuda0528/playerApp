import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Participant } from '../types/session'

function mergeParticipants(...groups: Participant[][]) {
  const byId = new Map<string, Participant>()
  for (const group of groups) {
    for (const participant of group) byId.set(participant.id, participant)
  }
  return Array.from(byId.values())
}

export function useParticipants(
  sessionId: string,
  options?: { onInsert?: (participant: Participant) => void }
) {
  const [participants, setParticipants] = useState<Participant[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<unknown>(null)
  const onInsertRef = useRef(options?.onInsert)
  useEffect(() => { onInsertRef.current = options?.onInsert })
  const participantsRef = useRef<Participant[]>([])
  useEffect(() => { participantsRef.current = participants }, [participants])

  const removeParticipant = useCallback((participantId: string) => {
    setParticipants((prev) => prev.filter((p) => p.id !== participantId))
  }, [])

  useEffect(() => {
    let cancelled = false
    const deletedParticipantIds = new Set<string>()
    setLoading(true)
    setError(null)

    const fetchParticipants = () => {
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
          const fetchedParticipants = data ? data as Participant[] : []
          setParticipants((prev) =>
            mergeParticipants(fetchedParticipants, prev)
              .filter((participant) => !deletedParticipantIds.has(participant.id))
          )
        })
    }

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
          const prevParticipants = participantsRef.current
          setParticipants((prev) => {
            if (prev.some((participant) => participant.id === newParticipant.id)) return prev
            return mergeParticipants(prev, [newParticipant])
          })
          if (!prevParticipants.some((participant) => participant.id === newParticipant.id)) {
            onInsertRef.current?.(newParticipant)
          }
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
          deletedParticipantIds.add(payload.old.id)
          removeParticipant(payload.old.id)
        }
      )
      .subscribe((status) => {
        if (cancelled) return
        if (status === 'SUBSCRIBED') {
          fetchParticipants()
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          setError(new Error('参加者の同期に失敗しました'))
          setLoading(false)
        }
      })

    return () => {
      cancelled = true
      supabase.removeChannel(channel)
    }
  }, [sessionId, removeParticipant])

  return { participants, loading, error, removeParticipant }
}
