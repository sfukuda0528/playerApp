import { useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Session, Participant } from '../types/session'

export function useSessionJoin() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const joinSession = async (
    code: string,
    name: string
  ): Promise<{ session: Session; participant: Participant } | null> => {
    setLoading(true)
    setError(null)
    try {
      const { data: authData, error: authError } = await supabase.auth.signInAnonymously()
      if (authError || !authData.user) {
        throw authError ?? new Error('認証に失敗しました')
      }

      const { data, error: rpcError } = await supabase.rpc('join_session', {
        p_code: code,
        p_name: name,
      })

      if (rpcError) {
        const msg = rpcError.message ?? ''
        if (msg.includes('session_not_found')) {
          setError('セッションが見つかりません')
        } else if (msg.includes('session_full')) {
          setError('このセッションは満員です')
        } else {
          throw rpcError
        }
        return null
      }

      return {
        session: data.session as Session,
        participant: data.participant as Participant,
      }
    } catch (err) {
      const msg = err instanceof Error
        ? err.message
        : (err as { message?: string })?.message ?? '参加に失敗しました'
      setError(msg)
      return null
    } finally {
      setLoading(false)
    }
  }

  return { joinSession, loading, error }
}
