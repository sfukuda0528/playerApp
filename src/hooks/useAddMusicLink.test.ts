import { renderHook, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useAddMusicLink, isValidMusicUrl } from './useAddMusicLink'

const { mockGetUser, mockLinkInsert, mockLinkDelete } = vi.hoisted(() => ({
  mockGetUser: vi.fn(),
  mockLinkInsert: vi.fn(),
  mockLinkDelete: vi.fn(),
}))

vi.mock('../lib/supabase', () => ({
  supabase: {
    auth: { getUser: mockGetUser },
    from: () => ({
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
  it('Twitter URL を拒否', () => {
    expect(isValidMusicUrl('https://twitter.com/something')).toBe(false)
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
  })

  it('有効URLで addLink: INSERT を呼びtrueを返す', async () => {
    const { result } = renderHook(() => useAddMusicLink())
    let ok: boolean | undefined
    await act(async () => {
      ok = await result.current.addLink('sess-1', 'https://youtu.be/abc')
    })
    expect(ok).toBe(true)
    expect(mockLinkInsert).toHaveBeenCalledOnce()
  })

  it('無効URLで addLink: INSERT を呼ばずfalseを返す', async () => {
    const { result } = renderHook(() => useAddMusicLink())
    let ok: boolean | undefined
    await act(async () => {
      ok = await result.current.addLink('sess-1', 'https://twitter.com/foo')
    })
    expect(ok).toBe(false)
    expect(mockLinkInsert).not.toHaveBeenCalled()
    expect(result.current.error).toBe('YouTube または YouTube Music の URL を入力してください')
  })

  it('music.youtube.com/watch URL を正規化して INSERT を呼ぶ', async () => {
    const { result } = renderHook(() => useAddMusicLink())
    await act(async () => {
      await result.current.addLink('sess-1', 'https://music.youtube.com/watch?v=abc')
    })
    expect(mockLinkInsert).toHaveBeenCalledWith(
      expect.objectContaining({ url: 'https://www.youtube.com/watch?v=abc' })
    )
  })

  it('youtube.com/playlist URL で addLink が true を返す', async () => {
    const { result } = renderHook(() => useAddMusicLink())
    let ok: boolean | undefined
    await act(async () => {
      ok = await result.current.addLink('sess-1', 'https://www.youtube.com/playlist?list=PLxxx')
    })
    expect(ok).toBe(true)
    expect(mockLinkInsert).toHaveBeenCalledOnce()
  })

  it('music.youtube.com/playlist URL を正規化して INSERT を呼ぶ', async () => {
    const { result } = renderHook(() => useAddMusicLink())
    await act(async () => {
      await result.current.addLink('sess-1', 'https://music.youtube.com/playlist?list=PLxxx')
    })
    expect(mockLinkInsert).toHaveBeenCalledWith(
      expect.objectContaining({ url: 'https://www.youtube.com/playlist?list=PLxxx' })
    )
  })

  it('deleteLink: DELETE を呼びtrueを返す', async () => {
    const { result } = renderHook(() => useAddMusicLink())
    let ok: boolean | undefined
    await act(async () => { ok = await result.current.deleteLink('ml-1') })
    expect(ok).toBe(true)
    expect(mockLinkDelete).toHaveBeenCalledOnce()
  })
})
