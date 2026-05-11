import { supabase } from '../lib/supabase'

export async function ensureAnonymousUser() {
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
  if (sessionError) throw sessionError
  if (sessionData.session?.user) return sessionData.session.user

  const { data: authData, error: authError } = await supabase.auth.signInAnonymously()
  if (authError || !authData.user) {
    throw authError ?? new Error('認証に失敗しました')
  }

  return authData.user
}
