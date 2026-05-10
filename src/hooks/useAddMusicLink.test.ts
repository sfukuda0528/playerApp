import { renderHook, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useAddMusicLink, isValidMusicUrl } from './useAddMusicLink'
import type { MusicLink } from '../types/session'

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

  describe('addLinks', () => {
    const makeLink = (id: string, sortOrder: number): MusicLink => ({
      id,
      session_id: 'sess-1',
      added_by_auth_id: 'uid-1',
      url: `https://youtu.be/${id}`,
      title: `動画 ${id}`,
      sort_order: sortOrder,
      created_at: '2026-05-10T00:00:00Z',
    })

    it('tail: N件をバッチ INSERT し true を返す', async () => {
      mockGetExtreme.mockResolvedValue({ data: { sort_order: 5000 } })
      mockLinkInsert.mockResolvedValue({ error: null })
      const items = [
        { url: 'https://youtu.be/vid1', title: '動画1' },
        { url: 'https://youtu.be/vid2', title: '動画2' },
      ]
      const { result } = renderHook(() => useAddMusicLink())
      let ok: boolean | undefined
      await act(async () => {
        ok = await result.current.addLinks('sess-1', items, 'tail')
      })
      expect(ok).toBe(true)
      const inserted = mockLinkInsert.mock.calls[0][0] as Array<{ sort_order: number; url: string }>
      expect(inserted).toHaveLength(2)
      expect(inserted[0]).toMatchObject({ url: 'https://youtu.be/vid1', sort_order: 6000 })
      expect(inserted[1]).toMatchObject({ url: 'https://youtu.be/vid2', sort_order: 7000 })
    })

    it('tail: キューが空のとき sort_order を 0, 1000 で INSERT する', async () => {
      mockGetExtreme.mockResolvedValue({ data: null })
      mockLinkInsert.mockResolvedValue({ error: null })
      const items = [
        { url: 'https://youtu.be/vid1', title: '動画1' },
        { url: 'https://youtu.be/vid2', title: '動画2' },
      ]
      const { result } = renderHook(() => useAddMusicLink())
      await act(async () => {
        await result.current.addLinks('sess-1', items, 'tail')
      })
      const inserted = mockLinkInsert.mock.calls[0][0] as Array<{ sort_order: number }>
      expect(inserted[0].sort_order).toBe(0)
      expect(inserted[1].sort_order).toBe(1000)
    })

    it('head: currentLink と nextLink の間に均等配置する', async () => {
      mockLinkInsert.mockResolvedValue({ error: null })
      const currentLink = makeLink('ml-1', 1000)
      const nextLink = makeLink('ml-2', 4000)
      const items = [
        { url: 'https://youtu.be/vid1', title: '動画1' },
        { url: 'https://youtu.be/vid2', title: '動画2' },
      ]
      // step = (4000 - 1000) / (2 + 1) = 1000
      // item[0]: 1000 + 1000 * 1 = 2000
      // item[1]: 1000 + 1000 * 2 = 3000
      const { result } = renderHook(() => useAddMusicLink())
      await act(async () => {
        await result.current.addLinks('sess-1', items, 'head', currentLink, nextLink)
      })
      expect(mockGetExtreme).not.toHaveBeenCalled()
      const inserted = mockLinkInsert.mock.calls[0][0] as Array<{ sort_order: number }>
      expect(inserted[0].sort_order).toBe(2000)
      expect(inserted[1].sort_order).toBe(3000)
    })

    it('head: nextLink なしのとき currentSort + 1000 * (i+1) で INSERT する', async () => {
      mockLinkInsert.mockResolvedValue({ error: null })
      const currentLink = makeLink('ml-1', 1000)
      const items = [
        { url: 'https://youtu.be/vid1', title: '動画1' },
        { url: 'https://youtu.be/vid2', title: '動画2' },
      ]
      // step = 1000
      // item[0]: 1000 + 1000 * 1 = 2000
      // item[1]: 1000 + 1000 * 2 = 3000
      const { result } = renderHook(() => useAddMusicLink())
      await act(async () => {
        await result.current.addLinks('sess-1', items, 'head', currentLink, undefined)
      })
      const inserted = mockLinkInsert.mock.calls[0][0] as Array<{ sort_order: number }>
      expect(inserted[0].sort_order).toBe(2000)
      expect(inserted[1].sort_order).toBe(3000)
    })

    it('空配列で INSERT を呼ばず false を返す', async () => {
      const { result } = renderHook(() => useAddMusicLink())
      let ok: boolean | undefined
      await act(async () => {
        ok = await result.current.addLinks('sess-1', [], 'tail')
      })
      expect(ok).toBe(false)
      expect(mockLinkInsert).not.toHaveBeenCalled()
    })

    it('INSERT 失敗で false を返し error をセットする', async () => {
      mockGetExtreme.mockResolvedValue({ data: { sort_order: 0 } })
      mockLinkInsert.mockResolvedValue({ error: { message: 'DB error' } })
      const { result } = renderHook(() => useAddMusicLink())
      let ok: boolean | undefined
      await act(async () => {
        ok = await result.current.addLinks('sess-1', [{ url: 'https://youtu.be/v', title: 'v' }], 'tail')
      })
      expect(ok).toBe(false)
      expect(result.current.error).toBeTruthy()
    })
  })
})
