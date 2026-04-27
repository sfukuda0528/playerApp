import { useState } from 'react'
import { supabase } from '../lib/supabase'

export function useSessionEnd() {
  const [loading, setLoading] = useState(false)

  const endSession = async (sessionId: string): Promise<boolean> => {
    setLoading(true)
    try {
      const { error } = await supabase
        .from('sessions')
        .update({ status: 'ended' })
        .eq('id', sessionId)
      return !error
    } finally {
      setLoading(false)
    }
  }

  return { endSession, loading }
}
