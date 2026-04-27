import { renderHook, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { usePhotos } from './usePhotos'
import type { Photo } from '../types/session'

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
    mockOn.mockImplementation((_event: string, _filter: unknown, handler: (payload: unknown) => void) => {
      handlers.push(handler)
      return { on: mockOn, subscribe: vi.fn() }
    })
    mockChannel.mockReturnValue({ on: mockOn })
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
    handlers[0]({ new: photo2 })
    await waitFor(() => expect(result.current.photos).toHaveLength(2))
    expect(result.current.photos[1].id).toBe('ph-2')
  })

  it('Realtime DELETE: 該当写真を除去する', async () => {
    const { result } = renderHook(() => usePhotos('sess-1'))
    await waitFor(() => expect(result.current.loading).toBe(false))

    // handlers[1] = DELETE ハンドラ
    handlers[1]({ old: { id: 'ph-1' } })
    await waitFor(() => expect(result.current.photos).toHaveLength(0))
  })

  it('アンマウント時: チャンネルを削除する', () => {
    const { unmount } = renderHook(() => usePhotos('sess-1'))
    unmount()
    expect(mockRemoveChannel).toHaveBeenCalledOnce()
  })
})
