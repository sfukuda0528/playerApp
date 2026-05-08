import { renderHook, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { useYouTubeVideoTitle } from './useYouTubeVideoTitle'

const mockFetch = vi.fn()

beforeEach(() => { vi.stubGlobal('fetch', mockFetch) })
afterEach(() => { vi.unstubAllGlobals() })

describe('useYouTubeVideoTitle', () => {
  it('fetchTitle 成功でタイトルをセットする', async () => {
    mockFetch.mockResolvedValue({ ok: true, json: async () => ({ title: 'テスト動画' }) })
    const { result } = renderHook(() => useYouTubeVideoTitle())

    await act(async () => {
      await result.current.fetchTitle('https://www.youtube.com/watch?v=abc')
    })

    expect(result.current.title).toBe('テスト動画')
    const calledUrl = mockFetch.mock.calls[0][0] as string
    expect(calledUrl).toContain('youtube.com/oembed')
    expect(calledUrl).toContain('format=json')
  })

  it('oEmbed API エラーで title は null のまま', async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 404 })
    const { result } = renderHook(() => useYouTubeVideoTitle())

    await act(async () => {
      await result.current.fetchTitle('https://www.youtube.com/watch?v=invalid')
    })

    expect(result.current.title).toBeNull()
  })

  it('ネットワークエラーで title は null のまま', async () => {
    mockFetch.mockRejectedValue(new Error('network error'))
    const { result } = renderHook(() => useYouTubeVideoTitle())

    await act(async () => {
      await result.current.fetchTitle('https://www.youtube.com/watch?v=abc')
    })

    expect(result.current.title).toBeNull()
  })

  it('clear で title を null にリセットする', async () => {
    mockFetch.mockResolvedValue({ ok: true, json: async () => ({ title: 'テスト動画' }) })
    const { result } = renderHook(() => useYouTubeVideoTitle())

    await act(async () => { await result.current.fetchTitle('https://youtu.be/abc') })
    expect(result.current.title).toBe('テスト動画')

    act(() => { result.current.clear() })
    expect(result.current.title).toBeNull()
  })
})
