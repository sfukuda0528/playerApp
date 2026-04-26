import { renderHook, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useMusicLinks } from './useMusicLinks'
import type { MusicLink } from '../types/session'

const { mockOn, mockChannel, mockRemoveChannel, mockInitialFetch } = vi.hoisted(() => ({
  mockOn: vi.fn(),
  mockChannel: vi.fn(),
  mockRemoveChannel: vi.fn(),
  mockInitialFetch: vi.fn(),
}))

vi.mock('../lib/supabase', () => ({
  supabase: {
    from: () => ({
      select: () => ({ eq: () => ({ order: () => mockInitialFetch() }) }),
    }),
    channel: mockChannel,
    removeChannel: mockRemoveChannel,
  },
}))

const link1: MusicLink = {
  id: 'ml-1', session_id: 'sess-1', added_by_auth_id: 'uid-1',
  url: 'https://open.spotify.com/track/abc', created_at: '2026-04-26T10:00:00Z',
}
const link2: MusicLink = {
  id: 'ml-2', session_id: 'sess-1', added_by_auth_id: 'uid-2',
  url: 'https://www.youtube.com/watch?v=xyz', created_at: '2026-04-26T10:01:00Z',
}

describe('useMusicLinks', () => {
  let handlers: Array<(payload: unknown) => void> = []

  beforeEach(() => {
    vi.clearAllMocks()
    handlers = []
    mockInitialFetch.mockResolvedValue({ data: [link1], error: null })
    mockOn.mockImplementation((_event: string, _filter: unknown, handler: (payload: unknown) => void) => {
      handlers.push(handler)
      return { on: mockOn, subscribe: vi.fn() }
    })
    mockChannel.mockReturnValue({ on: mockOn })
  })

  it('初期取得: 既存リンクリストを返す', async () => {
    const { result } = renderHook(() => useMusicLinks('sess-1'))
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.links).toHaveLength(1)
    expect(result.current.links[0].id).toBe('ml-1')
  })

  it('Realtime INSERT: 新規リンクを末尾に追加する', async () => {
    const { result } = renderHook(() => useMusicLinks('sess-1'))
    await waitFor(() => expect(result.current.loading).toBe(false))

    handlers[0]({ new: link2 })
    await waitFor(() => expect(result.current.links).toHaveLength(2))
    expect(result.current.links[1].id).toBe('ml-2')
  })

  it('Realtime DELETE: 該当リンクを除去する', async () => {
    const { result } = renderHook(() => useMusicLinks('sess-1'))
    await waitFor(() => expect(result.current.loading).toBe(false))

    handlers[1]({ old: { id: 'ml-1' } })
    await waitFor(() => expect(result.current.links).toHaveLength(0))
  })

  it('アンマウント時: チャンネルを削除する', () => {
    const { unmount } = renderHook(() => useMusicLinks('sess-1'))
    unmount()
    expect(mockRemoveChannel).toHaveBeenCalledOnce()
  })
})
