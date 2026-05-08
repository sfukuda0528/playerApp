import { renderHook, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useAddMusicLink, isValidMusicUrl } from './useAddMusicLink'

const { mockGetUser, mockLinkInsert, mockLinkDelete, mockGetExtreme } = vi.hoisted(() => ({
  mockGetUser: vi.fn(),
  mockLinkInsert: vi.fn(),
  mockLinkDelete: vi.fn(),
  mockGetExtreme: vi.fn(),
}))

vi.mock('../lib/supabase', () => ({
  supabase: {
    auth: { getUser: mockGetUser },
    from: () => ({
      select: () => ({
        eq: () => ({
          order: () => ({
            limit: () => ({
              maybeSingle: mockGetExtreme,
            }),
          }),
        }),
      }),
      insert: (data: unknown) => mockLinkInsert(data),
      delete: () => ({ eq: () => mockLinkDelete() }),
    }),
  },
}))

describe('isValidMusicUrl', () => {
  it('YouTube watch URL を許可', () => {
    expect(isValidMusicUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe(true)
  })
  it('youtu.be short URL を許可', () => {
    expect(isValidMusicUrl('https://youtu.be/dQw4w9WgXcQ')).toBe(true)
  })
  it('youtube.com/playlist URL を許可', () => {
    expect(isValidMusicUrl('https://www.youtube.com/playlist?list=PLxxx')).toBe(true)
  })
  it('Spotify URL を拒否', () => {
    expect(isValidMusicUrl('https://open.spotify.com/track/abc')).toBe(false)
  })
  it('任意の文字列を拒否', () => {
    expect(isValidMusicUrl('not a url')).toBe(false)
  })
})

describe('useAddMusicLink', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetUser.mockResolvedValue({ data: { user: { id: 'uid-1' } } })
    mockLinkInsert.mockResolvedValue({ error: null })
    mockLinkDelete.mockResolvedValue({ error: null })
    mockGetExtreme.mockResolvedValue({ data: null })
  })

  it('有効URL・tail で addLink: INSERT を呼び true を返す', async () => {
    const { result } = renderHook(() => useAddMusicLink())
    let ok: boolean | undefined
    await act(async () => {
      ok = await result.current.addLink('sess-1', 'https://youtu.be/abc', 'テスト動画', 'tail')
    })
    expect(ok).toBe(true)
    expect(mockLinkInsert).toHaveBeenCalledOnce()
  })

  it('無効URL で addLink: INSERT を呼ばず false を返す', async () => {
    const { result } = renderHook(() => useAddMusicLink())
    let ok: boolean | undefined
    await act(async () => {
      ok = await result.current.addLink('sess-1', 'https://twitter.com/foo', 'ツイート', 'tail')
    })
    expect(ok).toBe(false)
    expect(mockLinkInsert).not.toHaveBeenCalled()
    expect(result.current.error).toBe('YouTube または YouTube Music の URL を入力してください')
  })

  it('position=tail: MAX(sort_order)+1000 で INSERT する', async () => {
    mockGetExtreme.mockResolvedValue({ data: { sort_order: 5000 } })
    const { result } = renderHook(() => useAddMusicLink())
    await act(async () => {
      await result.current.addLink('sess-1', 'https://youtu.be/abc', 'テスト動画', 'tail')
    })
    expect(mockLinkInsert).toHaveBeenCalledWith(
      expect.objectContaining({ sort_order: 6000, title: 'テスト動画' })
    )
  })

  it('position=head: MIN(sort_order)-1000 で INSERT する', async () => {
    mockGetExtreme.mockResolvedValue({ data: { sort_order: 3000 } })
    const { result } = renderHook(() => useAddMusicLink())
    await act(async () => {
      await result.current.addLink('sess-1', 'https://youtu.be/abc', 'テスト動画', 'head')
    })
    expect(mockLinkInsert).toHaveBeenCalledWith(
      expect.objectContaining({ sort_order: 2000 })
    )
  })

  it('リンクが空のとき sort_order は 0', async () => {
    mockGetExtreme.mockResolvedValue({ data: null })
    const { result } = renderHook(() => useAddMusicLink())
    await act(async () => {
      await result.current.addLink('sess-1', 'https://youtu.be/abc', 'テスト動画', 'tail')
    })
    expect(mockLinkInsert).toHaveBeenCalledWith(
      expect.objectContaining({ sort_order: 0 })
    )
  })

  it('music.youtube.com URL を正規化して INSERT する', async () => {
    const { result } = renderHook(() => useAddMusicLink())
    await act(async () => {
      await result.current.addLink('sess-1', 'https://music.youtube.com/watch?v=abc', 'MYT動画', 'tail')
    })
    expect(mockLinkInsert).toHaveBeenCalledWith(
      expect.objectContaining({ url: 'https://www.youtube.com/watch?v=abc' })
    )
  })

  it('deleteLink: DELETE を呼び true を返す', async () => {
    const { result } = renderHook(() => useAddMusicLink())
    let ok: boolean | undefined
    await act(async () => { ok = await result.current.deleteLink('ml-1') })
    expect(ok).toBe(true)
    expect(mockLinkDelete).toHaveBeenCalledOnce()
  })
})
