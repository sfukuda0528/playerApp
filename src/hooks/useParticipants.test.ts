import { renderHook, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useParticipants } from './useParticipants'
import type { Participant } from '../types/session'

const {
  mockUnsubscribe,
  mockSubscribe,
  mockOn,
  mockChannel,
  mockRemoveChannel,
  mockInitialFetch,
} = vi.hoisted(() => ({
  mockUnsubscribe: vi.fn(),
  mockSubscribe: vi.fn(() => ({ unsubscribe: vi.fn() })),
  mockOn: vi.fn(),
  mockChannel: vi.fn(),
  mockRemoveChannel: vi.fn(),
  mockInitialFetch: vi.fn(),
}))

vi.mock('../lib/supabase', () => ({
  supabase: {
    from: () => ({
      select: () => ({ eq: () => mockInitialFetch() }),
    }),
    channel: mockChannel,
    removeChannel: mockRemoveChannel,
  },
}))

const alice: Participant = {
  id: 'p-1', session_id: 'sess-1', name: 'Alice',
  auth_id: 'uid-1', joined_at: '2026-04-24T10:00:00Z',
}
const bob: Participant = {
  id: 'p-2', session_id: 'sess-1', name: 'Bob',
  auth_id: 'uid-2', joined_at: '2026-04-24T10:05:00Z',
}

describe('useParticipants', () => {
  let insertHandler: (payload: { new: Participant }) => void

  beforeEach(() => {
    vi.clearAllMocks()
    mockInitialFetch.mockResolvedValue({ data: [alice], error: null })
    mockOn.mockImplementation((_event: string, _filter: unknown, handler: (payload: { new: Participant }) => void) => {
      insertHandler = handler
      return { subscribe: mockSubscribe }
    })
    mockChannel.mockReturnValue({ on: mockOn })
  })

  it('初期取得: 既存参加者リストを返す', async () => {
    const { result } = renderHook(() => useParticipants('sess-1'))
    await waitFor(() => expect(result.current.participants).toHaveLength(1))
    expect(result.current.participants[0].name).toBe('Alice')
  })

  it('Realtime INSERT: 新規参加者を追加する', async () => {
    const { result } = renderHook(() => useParticipants('sess-1'))
    await waitFor(() => expect(result.current.participants).toHaveLength(1))

    // Realtimeイベントをシミュレート
    insertHandler({ new: bob })
    await waitFor(() => expect(result.current.participants).toHaveLength(2))
    expect(result.current.participants[1].name).toBe('Bob')
  })

  it('アンマウント時: チャンネルを削除する', () => {
    const { unmount } = renderHook(() => useParticipants('sess-1'))
    unmount()
    expect(mockRemoveChannel).toHaveBeenCalledOnce()
  })
})
