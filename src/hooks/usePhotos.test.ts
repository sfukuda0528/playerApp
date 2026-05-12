import { act, renderHook, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { usePhotos } from './usePhotos'
import type { Photo } from '../types/session'

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

const photo1: Photo = {
  id: 'ph-1', session_id: 'sess-1', uploader_auth_id: 'uid-1',
  storage_path: 'sess-1/001_a.jpg', created_at: '2026-04-26T10:00:00Z',
}
const photo2: Photo = {
  id: 'ph-2', session_id: 'sess-1', uploader_auth_id: 'uid-2',
  storage_path: 'sess-1/002_b.jpg', created_at: '2026-04-26T10:01:00Z',
}

describe('usePhotos', () => {
  let handlers: Array<(payload: unknown) => void> = []

  beforeEach(() => {
    vi.clearAllMocks()
    handlers = []
    mockInitialFetch.mockResolvedValue({ data: [photo1], error: null })
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

  it('初期取得: 既存写真リストを返す', async () => {
    const { result } = renderHook(() => usePhotos('sess-1'))
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.photos).toHaveLength(1)
    expect(result.current.photos[0].id).toBe('ph-1')
  })

  it('Realtime INSERT: 新規写真を末尾に追加する', async () => {
    const { result } = renderHook(() => usePhotos('sess-1'))
    await waitFor(() => expect(result.current.loading).toBe(false))

    // handlers[0] = INSERT ハンドラ
    act(() => { handlers[0]({ new: photo2 }) })
    await waitFor(() => expect(result.current.photos).toHaveLength(2))
    expect(result.current.photos[1].id).toBe('ph-2')
  })

  it('初期取得は Realtime 購読確立後に開始する', () => {
    mockSubscribe.mockImplementation(() => ({ on: mockOn, subscribe: mockSubscribe }))

    const { result } = renderHook(() => usePhotos('sess-1'))

    expect(mockInitialFetch).not.toHaveBeenCalled()
    expect(result.current.loading).toBe(true)
  })

  it('初期取得中に届いた INSERT を fetch 結果で消さない', async () => {
    let resolveFetch: (value: { data: Photo[]; error: null }) => void = () => {}
    mockInitialFetch.mockReturnValue(new Promise((resolve) => {
      resolveFetch = resolve
    }))

    const { result } = renderHook(() => usePhotos('sess-1'))
    await waitFor(() => expect(mockInitialFetch).toHaveBeenCalledOnce())

    act(() => { handlers[0]({ new: photo2 }) })
    await waitFor(() => expect(result.current.photos.map((photo) => photo.id)).toEqual(['ph-2']))

    resolveFetch({ data: [photo1], error: null })
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.photos.map((photo) => photo.id)).toEqual(['ph-1', 'ph-2'])
  })

  it('初期取得中に届いた DELETE を fetch 結果で復活させない', async () => {
    let resolveFetch: (value: { data: Photo[]; error: null }) => void = () => {}
    mockInitialFetch.mockReturnValue(new Promise((resolve) => {
      resolveFetch = resolve
    }))

    const { result } = renderHook(() => usePhotos('sess-1'))
    await waitFor(() => expect(mockInitialFetch).toHaveBeenCalledOnce())

    act(() => { handlers[1]({ old: { id: 'ph-2' } }) })
    resolveFetch({ data: [photo1, photo2], error: null })

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.photos.map((photo) => photo.id)).toEqual(['ph-1'])
  })

  it('Realtime DELETE: 該当写真を除去する', async () => {
    const { result } = renderHook(() => usePhotos('sess-1'))
    await waitFor(() => expect(result.current.loading).toBe(false))

    // handlers[1] = DELETE ハンドラ
    act(() => { handlers[1]({ old: { id: 'ph-1' } }) })
    await waitFor(() => expect(result.current.photos).toHaveLength(0))
  })

  it('アンマウント時: チャンネルを削除する', () => {
    const { unmount } = renderHook(() => usePhotos('sess-1'))
    unmount()
    expect(mockRemoveChannel).toHaveBeenCalledOnce()
  })

  it('Realtime INSERT: onInsert コールバックを呼ぶ', async () => {
    const onInsert = vi.fn()
    const { result } = renderHook(() => usePhotos('sess-1', { onInsert }))
    await waitFor(() => expect(result.current.loading).toBe(false))
    act(() => { handlers[0]({ new: photo2 }) })
    await waitFor(() => expect(onInsert).toHaveBeenCalledWith(photo2))
  })
})
