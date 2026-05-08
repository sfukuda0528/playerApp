export type SessionStatus = 'active' | 'ended'

export interface Session {
  id: string
  code: string
  host_name: string
  host_auth_id: string | null
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

export interface Photo {
  id: string
  session_id: string
  uploader_auth_id: string
  storage_path: string
  created_at: string
}

export interface MusicLink {
  id: string
  session_id: string
  added_by_auth_id: string
  url: string
  title: string
  sort_order: number
  created_at: string
}
