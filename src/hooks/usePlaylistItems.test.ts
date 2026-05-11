import { renderHook, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { usePlaylistItems } from './usePlaylistItems'

const mockFetch = vi.fn()

beforeEach(() => {
  mockFetch.mockClear()
  vi.stubGlobal('fetch', mockFetch)
})
afterEach(() => {
  vi.unstubAllGlobals()
})

const mockApiResponse = {
  items: [
    { snippet: { title: '動画1', resourceId: { videoId: 'vid-1' } } },
    { snippet: { title: '動画2', resourceId: { videoId: 'vid-2' } } },
  ],
}

describe('usePlaylistItems', () => {
  it('fetchPlaylistItems で playlistItems API を正しいパラメータで呼ぶ', async () => {
    mockFetch.mockResolvedValue({ ok: true, json: async () => mockApiResponse })
    const { result } = renderHook(() => usePlaylistItems())

    await act(async () => { await result.current.fetchPlaylistItems('PLxxx') })

    expect(mockFetch).toHaveBeenCalledOnce()
    const url = mockFetch.mock.calls[0][0] as string
    expect(url).toContain('googleapis.com/youtube/v3/playlistItems')
    expect(url).toContain('playlistId=PLxxx')
    expect(url).toContain('maxResults=50')
    expect(url).toContain('part=snippet')
  })

  it('成功時に PlaylistItem[] を返す', async () => {
    mockFetch.mockResolvedValue({ ok: true, json: async () => mockApiResponse })
    const { result } = renderHook(() => usePlaylistItems())
    let items: { videoId: string; title: string }[] | null = null

    await act(async () => { items = await result.current.fetchPlaylistItems('PLxxx') })

    expect(items).toEqual([
      { videoId: 'vid-1', title: '動画1' },
      { videoId: 'vid-2', title: '動画2' },
    ])
    expect(result.current.error).toBeNull()
  })

  it('空プレイリストで error をセットし null を返す', async () => {
    mockFetch.mockResolvedValue({ ok: true, json: async () => ({ items: [] }) })
    const { result } = renderHook(() => usePlaylistItems())
    let items: { videoId: string; title: string }[] | null | undefined

    await act(async () => { items = await result.current.fetchPlaylistItems('PLxxx') })

    expect(items).toBeNull()
    expect(result.current.error).toBe('プレイリストに動画がありません')
  })

  it('API エラーで error をセットし null を返す', async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 403, json: async () => ({}) })
    const { result } = renderHook(() => usePlaylistItems())
    let items: { videoId: string; title: string }[] | null | undefined

    await act(async () => { items = await result.current.fetchPlaylistItems('PLxxx') })

    expect(items).toBeNull()
    expect(result.current.error).toBeTruthy()
  })

  it('2回目の呼び出しで前の error がリセットされる', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 403, json: async () => ({}) })
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => mockApiResponse })
    const { result } = renderHook(() => usePlaylistItems())

    await act(async () => { await result.current.fetchPlaylistItems('PLxxx') })
    expect(result.current.error).toBeTruthy()

    await act(async () => { await result.current.fetchPlaylistItems('PLxxx') })
    expect(result.current.error).toBeNull()
  })
})
