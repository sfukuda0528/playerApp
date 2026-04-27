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
      // 1. セッション検索（sessionsはRLS "read all"なので認証不要）
      const { data: session, error: sessionError } = await supabase
        .from('sessions')
        .select()
        .eq('code', code)
        .eq('status', 'active')
        .single()

      if (sessionError || !session) {
        console.error('[join] step1 sessionError:', sessionError)
        setError('セッションが見つかりません')
        return null
      }

      // 2. 匿名サインイン（participantsのRLS適用のため、カウント前に実行）
      const { data: authData, error: authError } = await supabase.auth.signInAnonymously()
      if (authError || !authData.user) {
        console.error('[join] step2 authError:', authError)
        throw authError ?? new Error('認証に失敗しました')
      }
      const authId = authData.user.id

      // 3. 参加者数チェック（認証済みでRLS通過）
      const { count, error: countError } = await supabase
        .from('participants')
        .select('*', { count: 'exact', head: true })
        .eq('session_id', session.id)

      if (countError) {
        console.error('[join] step3 countError:', countError)
        throw countError
      }
      if (count !== null && count >= 4) {
        setError('このセッションは満員です')
        return null
      }

      // 4. 参加者登録
      const { data: participant, error: participantError } = await supabase
        .from('participants')
        .insert({ session_id: session.id, name, auth_id: authId })
        .select()
        .single()
      if (participantError) {
        console.error('[join] step4 participantError:', participantError)
        throw participantError
      }

      const { error: updateError } = await supabase
        .from('sessions')
        .update({ last_active_at: new Date().toISOString() })
        .eq('id', session.id)
      if (updateError) {
        console.error('[join] step5 updateError:', updateError)
        throw updateError
      }

      return { session: session as Session, participant: participant as Participant }
    } catch (err) {
      const msg = err instanceof Error
        ? err.message
        : (err as { message?: string })?.message ?? '参加に失敗しました'
      console.error('[join] caught error:', err)
      setError(msg)
      return null
    } finally {
      setLoading(false)
    }
  }

  return { joinSession, loading, error }
}
