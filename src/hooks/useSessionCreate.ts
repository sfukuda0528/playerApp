import { useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Session } from '../types/session'

export function useSessionCreate() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const createSession = async (hostName: string): Promise<Session | null> => {
    setLoading(true)
    setError(null)
    try {
      const { data: authData, error: authError } = await supabase.auth.signInAnonymously()
      if (authError || !authData.user) throw authError ?? new Error('認証に失敗しました')

      const { data, error: rpcError } = await supabase.rpc('create_session', {
        p_host_name: hostName,
      })
      if (rpcError) throw rpcError

      return data as Session
    } catch (err) {
      setError(err instanceof Error ? err.message : 'セッション作成に失敗しました')
      return null
    } finally {
      setLoading(false)
    }
  }

  return { createSession, loading, error }
}
