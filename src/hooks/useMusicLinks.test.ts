import { act, renderHook, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useMusicLinks } from './useMusicLinks'
import type { MusicLink } from '../types/session'

const { mockOn, mockSubscribe, mockChannel, mockRemoveChannel, mockInitialFetch } = vi.hoisted(() => ({
  mockOn: vi.fn(),
  mockSubscribe: vi.fn(),
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
    const channelApi = { on: mockOn, subscribe: mockSubscribe }
    mockOn.mockImplementation((_event: string, _filter: unknown, handler: (payload: unknown) => void) => {
      handlers.push(handler)
      return channelApi
    })
    mockSubscribe.mockImplementation((callback?: (status: string) => void) => {
      callback?.('SUBSCRIBED')
      return channelApi
    })
    mockChannel.mockReturnValue(channelApi)
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

  it('初期取得は Realtime 購読確立後に開始する', async () => {
    mockSubscribe.mockImplementation(() => ({ on: mockOn, subscribe: mockSubscribe }))

    const { result } = renderHook(() => useMusicLinks('sess-1'))

    expect(mockInitialFetch).not.toHaveBeenCalled()
    expect(result.current.loading).toBe(true)
  })

  it('初期取得中に届いた INSERT を fetch 結果で消さない', async () => {
    let resolveFetch: (value: { data: MusicLink[]; error: null }) => void = () => {}
    mockInitialFetch.mockReturnValue(new Promise((resolve) => {
      resolveFetch = resolve
    }))

    const { result } = renderHook(() => useMusicLinks('sess-1'))
    await waitFor(() => expect(mockInitialFetch).toHaveBeenCalledOnce())

    handlers[0]({ new: link2 })
    await waitFor(() => expect(result.current.links.map((link) => link.id)).toEqual(['ml-2']))

    resolveFetch({ data: [link1], error: null })
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.links.map((link) => link.id)).toEqual(['ml-1', 'ml-2'])
  })

  it('初期取得中に削除されたリンクを遅い fetch 結果で復活させない', async () => {
    let resolveFetch: (value: { data: MusicLink[]; error: null }) => void = () => {}
    mockInitialFetch.mockReturnValue(new Promise((resolve) => {
      resolveFetch = resolve
    }))

    const { result } = renderHook(() => useMusicLinks('sess-1'))
    await waitFor(() => expect(mockInitialFetch).toHaveBeenCalledOnce())

    act(() => { handlers[0]({ new: link1 }) })
    await waitFor(() => expect(result.current.links.map((link) => link.id)).toEqual(['ml-1']))

    act(() => { handlers[2]({ old: { id: 'ml-1' } }) })
    await waitFor(() => expect(result.current.links).toHaveLength(0))

    await act(async () => { resolveFetch({ data: [link1], error: null }) })
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.links).toHaveLength(0)
  })

  it('復帰時の再取得では Realtime で取りこぼした削除をローカルキューから除去する', async () => {
    mockInitialFetch
      .mockResolvedValueOnce({ data: [link1, link2], error: null })
      .mockResolvedValueOnce({ data: [link2], error: null })

    const { result } = renderHook(() => useMusicLinks('sess-1'))
    await waitFor(() => expect(result.current.links.map((link) => link.id)).toEqual(['ml-1', 'ml-2']))

    await act(async () => {
      window.dispatchEvent(new Event('focus'))
    })

    await waitFor(() => expect(result.current.links.map((link) => link.id)).toEqual(['ml-2']))
  })

  it('optimisticDelete: 指定リンクを即座に除去する', async () => {
    mockInitialFetch.mockResolvedValue({ data: [link1, link2], error: null })
    const { result } = renderHook(() => useMusicLinks('sess-1'))
    await waitFor(() => expect(result.current.loading).toBe(false))

    act(() => { result.current.optimisticDelete('ml-1') })

    expect(result.current.links.map((link) => link.id)).toEqual(['ml-2'])
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
