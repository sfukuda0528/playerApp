import { renderHook, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useSessionJoin } from './useSessionJoin'

const {
  mockSignInAnonymously,
  mockSessionSelect,
  mockCountSelect,
  mockParticipantInsert,
  mockSessionUpdate,
} = vi.hoisted(() => ({
  mockSignInAnonymously: vi.fn(),
  mockSessionSelect: vi.fn(),
  mockCountSelect: vi.fn(),
  mockParticipantInsert: vi.fn(),
  mockSessionUpdate: vi.fn(),
}))

vi.mock('../lib/supabase', () => ({
  supabase: {
    auth: {
      signInAnonymously: mockSignInAnonymously,
      getSession: vi.fn().mockResolvedValue({
        data: { session: { user: { id: 'anon-uid-456' } } },
        error: null,
      }),
    },
    from: (table: string) => {
      if (table === 'sessions') {
        return {
          select: () => ({ eq: () => ({ eq: () => ({ single: mockSessionSelect }) }) }),
          update: () => ({ eq: () => mockSessionUpdate() }),
        }
      }
      if (table === 'participants') {
        return {
          select: (_col: unknown, opts?: { count: string; head: boolean }) =>
            opts?.count === 'exact'
              ? { eq: () => mockCountSelect() }
              : { eq: () => ({ eq: () => ({ single: mockParticipantInsert }) }) },
          insert: () => ({ select: () => ({ single: mockParticipantInsert }) }),
        }
      }
    },
  },
}))

const fakeSession = {
  id: 'sess-1', code: '472819', host_name: 'Alice',
  status: 'active', last_active_at: '2026-04-24T10:00:00Z',
  inactivity_timeout_min: 360, created_at: '2026-04-24T10:00:00Z',
}

describe('useSessionJoin', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSignInAnonymously.mockResolvedValue({
      data: { user: { id: 'anon-uid-456' } }, error: null,
    })
    mockSessionUpdate.mockResolvedValue({ error: null })
  })

  it('成功時: session と participant を返す', async () => {
    mockSessionSelect.mockResolvedValue({ data: fakeSession, error: null })
    mockCountSelect.mockResolvedValue({ count: 1, error: null })
    const fakeParticipant = {
      id: 'p-2', session_id: 'sess-1', name: 'Bob',
      auth_id: 'anon-uid-456', joined_at: '2026-04-24T10:05:00Z',
    }
    mockParticipantInsert.mockResolvedValue({ data: fakeParticipant, error: null })

    const { result } = renderHook(() => useSessionJoin())
    let joinResult: unknown
    await act(async () => { joinResult = await result.current.joinSession('472819', 'Bob') })

    expect(joinResult).toEqual({ session: fakeSession, participant: fakeParticipant })
    expect(result.current.error).toBeNull()
  })

  it('存在しないコード: nullを返し「セッションが見つかりません」をセット', async () => {
    mockSessionSelect.mockResolvedValue({ data: null, error: new Error('not found') })

    const { result } = renderHook(() => useSessionJoin())
    let joinResult: unknown
    await act(async () => { joinResult = await result.current.joinSession('000000', 'Bob') })

    expect(joinResult).toBeNull()
    expect(result.current.error).toBe('セッションが見つかりません')
  })

  it('満員(4人): nullを返し「満員です」をセット', async () => {
    mockSessionSelect.mockResolvedValue({ data: fakeSession, error: null })
    mockCountSelect.mockResolvedValue({ count: 4, error: null })

    const { result } = renderHook(() => useSessionJoin())
    let joinResult: unknown
    await act(async () => { joinResult = await result.current.joinSession('472819', 'Bob') })

    expect(joinResult).toBeNull()
    expect(result.current.error).toBe('このセッションは満員です')
  })
})
