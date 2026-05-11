import { renderHook, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useSessionCreate } from './useSessionCreate'

const { mockGetSession, mockSignInAnonymously, mockRpc } = vi.hoisted(() => ({
  mockGetSession: vi.fn(),
  mockSignInAnonymously: vi.fn(),
  mockRpc: vi.fn(),
}))

vi.mock('../lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: mockGetSession,
      signInAnonymously: mockSignInAnonymously,
    },
    rpc: mockRpc,
  },
}))

const fakeSession = {
  id: 'sess-1', code: '472819', host_name: 'Alice', host_auth_id: 'anon-uid-123',
  status: 'active', last_active_at: '2026-04-26T10:00:00Z',
  inactivity_timeout_min: 360, created_at: '2026-04-26T10:00:00Z',
}

describe('useSessionCreate', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetSession.mockResolvedValue({
      data: { session: null },
      error: null,
    })
    mockSignInAnonymously.mockResolvedValue({
      data: { user: { id: 'anon-uid-123' } },
      error: null,
    })
  })

  it('成功時: Sessionオブジェクトを返す', async () => {
    mockRpc.mockResolvedValue({ data: fakeSession, error: null })

    const { result } = renderHook(() => useSessionCreate())
    let session: unknown
    await act(async () => { session = await result.current.createSession('Alice') })

    expect(mockRpc).toHaveBeenCalledWith('create_session', { p_host_name: 'Alice' })
    expect(session).toEqual(fakeSession)
    expect(result.current.error).toBeNull()
    expect(result.current.loading).toBe(false)
  })

  it('既存Authセッションがある場合: 匿名Authを再作成せずセッションを作成する', async () => {
    mockGetSession.mockResolvedValue({
      data: { session: { user: { id: 'anon-uid-123' } } },
      error: null,
    })
    mockRpc.mockResolvedValue({ data: fakeSession, error: null })

    const { result } = renderHook(() => useSessionCreate())
    let session: unknown
    await act(async () => { session = await result.current.createSession('Alice') })

    expect(mockGetSession).toHaveBeenCalled()
    expect(mockSignInAnonymously).not.toHaveBeenCalled()
    expect(mockRpc).toHaveBeenCalledWith('create_session', { p_host_name: 'Alice' })
    expect(session).toEqual(fakeSession)
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

  it('RPC失敗時: nullを返しerrorをセット', async () => {
    mockRpc.mockResolvedValue({ data: null, error: new Error('could not generate unique code') })

    const { result } = renderHook(() => useSessionCreate())
    let session: unknown
    await act(async () => { session = await result.current.createSession('Alice') })

    expect(session).toBeNull()
    expect(result.current.error).toBeTruthy()
  })
})
