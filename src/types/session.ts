export type SessionStatus = 'active' | 'ended'

export interface Session {
  id: string
  code: string
  host_name: string
  status: SessionStatus
  last_active_at: string
  inactivity_timeout_min: number
  created_at: string
}

export interface Participant {
  id: string
  session_id: string
  name: string
  auth_id: string
  joined_at: string
}
