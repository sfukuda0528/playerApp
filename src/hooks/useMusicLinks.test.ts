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
  url: 'https://www.youtube.com/watch?v=aaa', title: '動画A', sort_order: 1000,
  created_at: '2026-04-26T10:00:00Z',
}
const link2: MusicLink = {
  id: 'ml-2', session_id: 'sess-1', added_by_auth_id: 'uid-2',
  url: 'https://www.youtube.com/watch?v=bbb', title: '動画B', sort_order: 2000,
  created_at: '2026-04-26T10:01:00Z',
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

  it('Realtime INSERT: 新規リンクを sort_order 順でリストに追加する', async () => {
    const { result } = renderHook(() => useMusicLinks('sess-1'))
    await waitFor(() => expect(result.current.loading).toBe(false))

    // link2 (sort_order=2000) は link1 (sort_order=1000) より後
    handlers[0]({ new: link2 })
    await waitFor(() => expect(result.current.links).toHaveLength(2))
    expect(result.current.links[1].id).toBe('ml-2')
  })

  it('Realtime INSERT: sort_order が小さいリンクは先頭に挿入される', async () => {
    const { result } = renderHook(() => useMusicLinks('sess-1'))
    await waitFor(() => expect(result.current.loading).toBe(false))

    const earlyLink: MusicLink = { ...link2, id: 'ml-early', sort_order: 500 }
    handlers[0]({ new: earlyLink })
    await waitFor(() => expect(result.current.links).toHaveLength(2))
    expect(result.current.links[0].id).toBe('ml-early')
  })

  it('Realtime UPDATE: 該当リンクの sort_order を更新してリストを再ソートする', async () => {
    mockInitialFetch.mockResolvedValue({ data: [link1, link2], error: null })
    const { result } = renderHook(() => useMusicLinks('sess-1'))
    await waitFor(() => expect(result.current.loading).toBe(false))

    // ml-1 の sort_order を 9999 に更新 → ml-2 が先頭になる
    handlers[1]({ new: { ...link1, sort_order: 9999 } })
    await waitFor(() => expect(result.current.links[0].id).toBe('ml-2'))
    expect(result.current.links[1].id).toBe('ml-1')
  })

  it('Realtime DELETE: 該当リンクを除去する', async () => {
    const { result } = renderHook(() => useMusicLinks('sess-1'))
    await waitFor(() => expect(result.current.loading).toBe(false))

    handlers[2]({ old: { id: 'ml-1' } })
    await waitFor(() => expect(result.current.links).toHaveLength(0))
  })

  it('アンマウント時: チャンネルを削除する', () => {
    const { unmount } = renderHook(() => useMusicLinks('sess-1'))
    unmount()
    expect(mockRemoveChannel).toHaveBeenCalledOnce()
  })

  it('INSERT イベントで onInsert コールバックが呼ばれる', async () => {
    const onInsert = vi.fn()
    const { result } = renderHook(() => useMusicLinks('sess-1', { onInsert }))
    await waitFor(() => expect(result.current.loading).toBe(false))

    handlers[0]({ new: link2 })
    await waitFor(() => expect(result.current.links).toHaveLength(2))
    expect(onInsert).toHaveBeenCalledOnce()
    expect(onInsert).toHaveBeenCalledWith(link2, [link1])
  })

  it('初期ロード（fetch）では onInsert が呼ばれない', async () => {
    const onInsert = vi.fn()
    const { result } = renderHook(() => useMusicLinks('sess-1', { onInsert }))
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(onInsert).not.toHaveBeenCalled()
  })

  it('DELETE イベントでは onInsert が呼ばれない', async () => {
    const onInsert = vi.fn()
    const { result } = renderHook(() => useMusicLinks('sess-1', { onInsert }))
    await waitFor(() => expect(result.current.loading).toBe(false))

    handlers[2]({ old: { id: 'ml-1' } })
    await waitFor(() => expect(result.current.links).toHaveLength(0))
    expect(onInsert).not.toHaveBeenCalled()
  })
})
