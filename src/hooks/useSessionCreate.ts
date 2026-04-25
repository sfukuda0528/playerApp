import { useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Session } from '../types/session'

function generateCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString()
}

export function useSessionCreate() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const createSession = async (hostName: string): Promise<Session | null> => {
    setLoading(true)
    setError(null)
    try {
      const { data: authData, error: authError } = await supabase.auth.signInAnonymously()
      if (authError || !authData.user) throw authError ?? new Error('認証に失敗しました')
      const authId = authData.user.id

      const { data: session, error: sessionError } = await supabase
        .from('sessions')
        .insert({
          code: generateCode(),
          host_name: hostName,
          status: 'active',
          last_active_at: new Date().toISOString(),
          inactivity_timeout_min: 360,
        })
        .select()
        .single()
      if (sessionError) throw sessionError

      const { error: participantError } = await supabase
        .from('participants')
        .insert({ session_id: session.id, name: hostName, auth_id: authId })
        .select()
        .single()
      if (participantError) throw participantError

      return session as Session
    } catch (err) {
      setError(err instanceof Error ? err.message : 'セッション作成に失敗しました')
      return null
    } finally {
      setLoading(false)
    }
  }

  return { createSession, loading, error }
}
