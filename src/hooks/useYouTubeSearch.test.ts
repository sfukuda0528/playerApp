import { renderHook, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { useYouTubeSearch } from './useYouTubeSearch'

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
    {
      id: { videoId: 'vid-1' },
      snippet: {
        title: 'テスト動画1',
        thumbnails: { medium: { url: 'https://img.youtube.com/vi/vid-1/mqdefault.jpg' } },
      },
    },
    {
      id: { videoId: 'vid-2' },
      snippet: {
        title: 'テスト動画2',
        thumbnails: { medium: { url: 'https://img.youtube.com/vi/vid-2/mqdefault.jpg' } },
      },
    },
  ],
}

describe('useYouTubeSearch', () => {
  it('search 呼び出しで YouTube API に正しいパラメータでフェッチする', async () => {
    mockFetch.mockResolvedValue({ ok: true, json: async () => mockApiResponse })
    const { result } = renderHook(() => useYouTubeSearch())

    await act(async () => { await result.current.search('テスト') })

    expect(mockFetch).toHaveBeenCalledOnce()
    const calledUrl = mockFetch.mock.calls[0][0] as string
    expect(calledUrl).toContain('googleapis.com/youtube/v3/search')
    expect(calledUrl).toContain('q=')
    expect(calledUrl).toContain('type=video')
    expect(calledUrl).toContain('maxResults=10')
  })

  it('search 成功で results に VideoItem リストをセットする', async () => {
    mockFetch.mockResolvedValue({ ok: true, json: async () => mockApiResponse })
    const { result } = renderHook(() => useYouTubeSearch())

    await act(async () => { await result.current.search('テスト') })

    expect(result.current.results).toHaveLength(2)
    expect(result.current.results[0]).toEqual({
      videoId: 'vid-1',
      title: 'テスト動画1',
      thumbnail: 'https://img.youtube.com/vi/vid-1/mqdefault.jpg',
    })
  })

  it('API エラーで error をセットし results は空のまま', async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 403 })
    const { result } = renderHook(() => useYouTubeSearch())

    await act(async () => { await result.current.search('テスト') })

    expect(result.current.error).toBeTruthy()
    expect(result.current.results).toHaveLength(0)
  })

  it('空クエリで search を呼んでも fetch を実行しない', async () => {
    const { result } = renderHook(() => useYouTubeSearch())
    await act(async () => { await result.current.search('  ') })
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('clear で results をリセットする', async () => {
    mockFetch.mockResolvedValue({ ok: true, json: async () => mockApiResponse })
    const { result } = renderHook(() => useYouTubeSearch())
    await act(async () => { await result.current.search('テスト') })
    expect(result.current.results).toHaveLength(2)
    act(() => { result.current.clear() })
    expect(result.current.results).toHaveLength(0)
  })

  it('search 中は loading が true になる', async () => {
    let resolveResponse: (v: unknown) => void
    mockFetch.mockReturnValue(new Promise(resolve => { resolveResponse = resolve }))
    const { result } = renderHook(() => useYouTubeSearch())

    act(() => { result.current.search('テスト') })
    expect(result.current.loading).toBe(true)

    await act(async () => {
      resolveResponse!({ ok: true, json: async () => mockApiResponse })
    })
    expect(result.current.loading).toBe(false)
  })
})
