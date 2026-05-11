import { describe, it, expect, beforeEach } from 'vitest'
import type { Session } from '../types/session'
import {
  LAST_SESSION_STORAGE_KEY,
  clearLastSession,
  loadLastSession,
  saveLastSession,
} from './lastSession'

const session: Session = {
  id: 'sess-1',
  code: '472819',
  host_name: 'Alice',
  host_auth_id: 'uid-host',
  status: 'active',
  last_active_at: '2026-05-11T00:00:00Z',
  inactivity_timeout_min: 360,
  created_at: '2026-05-11T00:00:00Z',
}

describe('lastSession storage', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('saves and loads the last session', () => {
    saveLastSession(session)

    expect(loadLastSession()).toEqual(session)
  })

  it('clears the last session', () => {
    saveLastSession(session)

    clearLastSession()

    expect(loadLastSession()).toBeNull()
  })

  it('removes malformed storage values', () => {
    localStorage.setItem(LAST_SESSION_STORAGE_KEY, '{bad json')

    expect(loadLastSession()).toBeNull()
    expect(localStorage.getItem(LAST_SESSION_STORAGE_KEY)).toBeNull()
  })

  it('removes values without a session id', () => {
    localStorage.setItem(LAST_SESSION_STORAGE_KEY, JSON.stringify({ code: '472819' }))

    expect(loadLastSession()).toBeNull()
    expect(localStorage.getItem(LAST_SESSION_STORAGE_KEY)).toBeNull()
  })
})
