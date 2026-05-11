import type { Session } from '../types/session'

export const LAST_SESSION_STORAGE_KEY = 'camp-canvas:last-session'

function isStoredSession(value: unknown): value is Session {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as { id?: unknown }).id === 'string' &&
    (value as { id: string }).id.length > 0
  )
}

export function saveLastSession(session: Session) {
  localStorage.setItem(LAST_SESSION_STORAGE_KEY, JSON.stringify(session))
}

export function loadLastSession(): Session | null {
  const raw = localStorage.getItem(LAST_SESSION_STORAGE_KEY)
  if (!raw) return null

  try {
    const parsed = JSON.parse(raw)
    if (isStoredSession(parsed)) return parsed
  } catch {
    // Malformed storage should not keep breaking the top page.
  }

  clearLastSession()
  return null
}

export function clearLastSession() {
  localStorage.removeItem(LAST_SESSION_STORAGE_KEY)
}
