import { renderHook, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useSessionJoin } from './useSessionJoin'

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
  id: 'sess-1', code: '472819', host_name: 'Alice',
  status: 'active', last_active_at: '2026-04-24T10:00:00Z',
  inactivity_timeout_min: 360, created_at: '2026-04-24T10:00:00Z',
}

const fakeParticipant = {
  id: 'p-2', session_id: 'sess-1', name: 'Bob',
  auth_id: 'anon-uid-456', joined_at: '2026-04-24T10:05:00Z',
}

describe('useSessionJoin', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetSession.mockResolvedValue({
      data: { session: null },
      error: null,
    })
    mockSignInAnonymously.mockResolvedValue({
      data: { user: { id: 'anon-uid-456' } }, error: null,
    })
  })

  it('成功時: session と participant を返す', async () => {
    mockRpc.mockResolvedValue({
      data: { session: fakeSession, participant: fakeParticipant },
      error: null,
    })

    const { result } = renderHook(() => useSessionJoin())
    let joinResult: unknown
    await act(async () => { joinResult = await result.current.joinSession('472819', 'Bob') })

    expect(mockRpc).toHaveBeenCalledWith('join_session', { p_code: '472819', p_name: 'Bob' })
    expect(joinResult).toEqual({ session: fakeSession, participant: fakeParticipant })
    expect(result.current.error).toBeNull()
  })

  it('既存Authセッションがある場合: 匿名Authを再作成せず参加する', async () => {
    mockGetSession.mockResolvedValue({
      data: { session: { user: { id: 'anon-uid-456' } } },
      error: null,
    })
    mockRpc.mockResolvedValue({
      data: { session: fakeSession, participant: fakeParticipant },
      error: null,
    })

    const { result } = renderHook(() => useSessionJoin())
    let joinResult: unknown
    await act(async () => { joinResult = await result.current.joinSession('472819', 'Bob') })

    expect(mockGetSession).toHaveBeenCalled()
    expect(mockSignInAnonymously).not.toHaveBeenCalled()
    expect(mockRpc).toHaveBeenCalledWith('join_session', { p_code: '472819', p_name: 'Bob' })
    expect(joinResult).toEqual({ session: fakeSession, participant: fakeParticipant })
  })

  it('存在しないコード: nullを返し「セッションが見つかりません」をセット', async () => {
    mockRpc.mockResolvedValue({
      data: null,
      error: { message: 'session_not_found' },
    })

    const { result } = renderHook(() => useSessionJoin())
    let joinResult: unknown
    await act(async () => { joinResult = await result.current.joinSession('000000', 'Bob') })

    expect(joinResult).toBeNull()
    expect(result.current.error).toBe('セッションが見つかりません')
  })

  it('満員(4人): nullを返し「満員です」をセット', async () => {
    mockRpc.mockResolvedValue({
      data: null,
      error: { message: 'session_full' },
    })

    const { result } = renderHook(() => useSessionJoin())
    let joinResult: unknown
    await act(async () => { joinResult = await result.current.joinSession('472819', 'Bob') })

    expect(joinResult).toBeNull()
    expect(result.current.error).toBe('このセッションは満員です')
  })

  it('認証失敗: nullを返しエラーをセット', async () => {
    mockSignInAnonymously.mockResolvedValue({
      data: { user: null }, error: new Error('auth failed'),
    })

    const { result } = renderHook(() => useSessionJoin())
    let joinResult: unknown
    await act(async () => { joinResult = await result.current.joinSession('472819', 'Bob') })

    expect(joinResult).toBeNull()
    expect(result.current.error).toBeTruthy()
  })
})
