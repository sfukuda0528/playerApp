import { renderHook, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useSessionCreate } from './useSessionCreate'

const { mockSignInAnonymously, mockSessionInsert, mockInsertArgs, mockParticipantInsert } = vi.hoisted(() => ({
  mockSignInAnonymously: vi.fn(),
  mockSessionInsert: vi.fn(),
  mockInsertArgs: vi.fn(),
  mockParticipantInsert: vi.fn(),
}))

vi.mock('../lib/supabase', () => ({
  supabase: {
    auth: { signInAnonymously: mockSignInAnonymously },
    from: (table: string) => {
      if (table === 'sessions') {
        return {
          insert: (args: unknown) => {
            mockInsertArgs(args)
            return { select: () => ({ single: mockSessionInsert }) }
          },
        }
      }
      if (table === 'participants') {
        return { insert: () => mockParticipantInsert() }
      }
    },
  },
}))

describe('useSessionCreate', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSignInAnonymously.mockResolvedValue({
      data: { user: { id: 'anon-uid-123' } },
      error: null,
    })
  })

  it('成功時: Sessionオブジェクトを返す', async () => {
    const fakeSession = {
      id: 'sess-1', code: '472819', host_name: 'Alice', host_auth_id: 'anon-uid-123',
      status: 'active', last_active_at: '2026-04-26T10:00:00Z',
      inactivity_timeout_min: 360, created_at: '2026-04-26T10:00:00Z',
    }
    mockSessionInsert.mockResolvedValue({ data: fakeSession, error: null })
    mockParticipantInsert.mockResolvedValue({
      data: { id: 'p-1', session_id: 'sess-1', name: 'Alice', auth_id: 'anon-uid-123', joined_at: '2026-04-26T10:00:00Z' },
      error: null,
    })

    const { result } = renderHook(() => useSessionCreate())
    let session: unknown
    await act(async () => { session = await result.current.createSession('Alice') })

    expect(session).toEqual(fakeSession)
    expect(result.current.error).toBeNull()
    expect(result.current.loading).toBe(false)
  })

  it('sessions INSERT に host_auth_id が含まれる', async () => {
    const fakeSession = {
      id: 'sess-1', code: '472819', host_name: 'Alice', host_auth_id: 'anon-uid-123',
      status: 'active', last_active_at: '2026-04-26T10:00:00Z',
      inactivity_timeout_min: 360, created_at: '2026-04-26T10:00:00Z',
    }
    mockSessionInsert.mockResolvedValue({ data: fakeSession, error: null })
    mockParticipantInsert.mockResolvedValue({ data: {}, error: null })

    const { result } = renderHook(() => useSessionCreate())
    await act(async () => { await result.current.createSession('Alice') })

    expect(mockInsertArgs).toHaveBeenCalledWith(
      expect.objectContaining({ host_auth_id: 'anon-uid-123' })
    )
  })

  it('匿名Auth失敗時: nullを返しerrorをセット', async () => {
    mockSignInAnonymously.mockResolvedValue({
      data: { user: null },
      error: new Error('auth failed'),
    })

    const { result } = renderHook(() => useSessionCreate())
    let session: unknown
    await act(async () => { session = await result.current.createSession('Alice') })

    expect(session).toBeNull()
    expect(result.current.error).toBe('auth failed')
  })

  it('DB INSERT失敗時: nullを返しerrorをセット', async () => {
    mockSessionInsert.mockResolvedValue({ data: null, error: new Error('duplicate code') })

    const { result } = renderHook(() => useSessionCreate())
    let session: unknown
    await act(async () => { session = await result.current.createSession('Alice') })

    expect(session).toBeNull()
    expect(result.current.error).toBeTruthy()
  })
})
