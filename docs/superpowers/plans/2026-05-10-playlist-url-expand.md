# プレイリストURL展開機能 実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** URLタブでプレイリストURLを入力した場合、プレイリスト内の動画を個別の `music_links` レコードとしてキューに追加する。

**Architecture:** 新フック `usePlaylistItems` で YouTube Playlist Items API を叩きビデオ一覧を取得（最大50件・1ページ目のみ）。`useAddMusicLink` に `addLinks`（バッチinsert）を追加。`MusicPanel` でプレイリストURL検知・2フェーズ進捗表示・両フック呼び出しを実装。`watch?v=xxx&list=yyy` 形式は既存の1曲フローで処理（プレイリスト展開なし）。

**Tech Stack:** React 19, TypeScript, Vitest 4, @testing-library/react, Supabase JS v2, YouTube Data API v3

---

## ファイル構成

| ファイル | 変更種別 | 内容 |
|----------|----------|------|
| `src/hooks/usePlaylistItems.ts` | 新規作成 | YouTube Playlist Items API フェッチフック |
| `src/hooks/usePlaylistItems.test.ts` | 新規作成 | usePlaylistItems のテスト |
| `src/hooks/useAddMusicLink.ts` | 変更 | `addLinks`（バッチinsert）追加、`MusicLink` import 追加 |
| `src/hooks/useAddMusicLink.test.ts` | 変更 | `addLinks` のテスト追加、`MusicLink` import 追加 |
| `src/components/MusicPanel.tsx` | 変更 | `usePlaylistItems` import・使用、`addLinks` 使用、プレイリスト検知・進捗表示 |
| `src/components/MusicPanel.test.tsx` | 変更 | `usePlaylistItems` mock 追加、`addLinks` mock 追加、プレイリスト対応テスト追加 |

---

### Task 1: usePlaylistItems フック

**Files:**
- Create: `src/hooks/usePlaylistItems.ts`
- Create: `src/hooks/usePlaylistItems.test.ts`

- [ ] **Step 1: テストファイルを作成**

`src/hooks/usePlaylistItems.test.ts` を新規作成:

```ts
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
```

- [ ] **Step 2: テストが失敗することを確認**

```
npx vitest run src/hooks/usePlaylistItems.test.ts
```
期待: エラー（`usePlaylistItems` が存在しないため）

- [ ] **Step 3: `usePlaylistItems` フックを実装**

`src/hooks/usePlaylistItems.ts` を新規作成:

```ts
import { useState } from 'react'

export interface PlaylistItem {
  videoId: string
  title: string
}

export function usePlaylistItems() {
  const [error, setError] = useState<string | null>(null)

  const fetchPlaylistItems = async (playlistId: string): Promise<PlaylistItem[] | null> => {
    setError(null)
    try {
      const apiKey = import.meta.env.VITE_YOUTUBE_API_KEY as string
      const params = new URLSearchParams({
        part: 'snippet',
        maxResults: '50',
        playlistId,
        key: apiKey,
      })
      const res = await fetch(`https://www.googleapis.com/youtube/v3/playlistItems?${params}`)
      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: { message?: string } }
        throw new Error(body.error?.message ?? `YouTube API error: ${res.status}`)
      }
      const json = await res.json() as {
        items: Array<{
          snippet: { title: string; resourceId: { videoId: string } }
        }>
      }
      if (json.items.length === 0) {
        setError('プレイリストに動画がありません')
        return null
      }
      return json.items.map(item => ({
        videoId: item.snippet.resourceId.videoId,
        title: item.snippet.title,
      }))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'プレイリストの取得に失敗しました')
      return null
    }
  }

  return { fetchPlaylistItems, error }
}
```

- [ ] **Step 4: テストが通ることを確認**

```
npx vitest run src/hooks/usePlaylistItems.test.ts
```
期待: 全テスト PASS

- [ ] **Step 5: コミット**

```bash
git add src/hooks/usePlaylistItems.ts src/hooks/usePlaylistItems.test.ts
git commit -m "feat: usePlaylistItems フックを追加（YouTube Playlist Items API）"
```

---

### Task 2: useAddMusicLink に addLinks バッチinsert を追加

**Files:**
- Modify: `src/hooks/useAddMusicLink.ts`
- Modify: `src/hooks/useAddMusicLink.test.ts`

sort_order 計算の仕様:
- `tail`: `baseSortOrder + 1000 * (i + 1)`（baseSortOrder = 既存末尾 or -1000 if empty）
- `head`: `currentLink.sort_order + step * (i + 1)`（step = `(nextLink.sort_order - currentLink.sort_order) / (N+1)` or 1000 if no nextLink）

- [ ] **Step 1: テストを追加**

`src/hooks/useAddMusicLink.test.ts` の先頭 import に `MusicLink` を追加:

```ts
import type { MusicLink } from '../types/session'
```

`describe('useAddMusicLink', ...)` ブロックの閉じ `})` の直前に追加:

```ts
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
```

- [ ] **Step 2: テストが失敗することを確認**

```
npx vitest run src/hooks/useAddMusicLink.test.ts
```
期待: `addLinks` が存在しないためエラー

- [ ] **Step 3: `addLinks` を `useAddMusicLink.ts` に実装**

`src/hooks/useAddMusicLink.ts` の先頭 import に `MusicLink` を追加:

```ts
import type { MusicLink } from '../types/session'
```

`return { addLink, deleteLink, loading, error }` の直前に `addLinks` 関数を追加:

```ts
  const addLinks = async (
    sessionId: string,
    items: { url: string; title: string }[],
    position: 'head' | 'tail',
    currentLink?: MusicLink,
    nextLink?: MusicLink
  ): Promise<boolean> => {
    if (items.length === 0) return false
    setError(null)
    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('認証が必要です')

      let baseSortOrder: number
      let step: number

      if (position === 'head' && currentLink) {
        baseSortOrder = currentLink.sort_order
        step = nextLink
          ? (nextLink.sort_order - currentLink.sort_order) / (items.length + 1)
          : 1000
      } else {
        const { data: extremeLink } = await supabase
          .from('music_links')
          .select('sort_order')
          .eq('session_id', sessionId)
          .order('sort_order', { ascending: false })
          .limit(1)
          .maybeSingle()
        baseSortOrder = extremeLink ? extremeLink.sort_order : -1000
        step = 1000
      }

      const rows = items.map((item, i) => ({
        session_id: sessionId,
        added_by_auth_id: user.id,
        url: item.url,
        title: item.title,
        sort_order: baseSortOrder + step * (i + 1),
      }))

      const { error: insertError } = await supabase.from('music_links').insert(rows)
      if (insertError) throw insertError

      return true
    } catch (err) {
      setError(err instanceof Error ? err.message : '追加に失敗しました')
      return false
    } finally {
      setLoading(false)
    }
  }
```

`return` 文を更新:

```ts
  return { addLink, addLinks, deleteLink, loading, error }
```

- [ ] **Step 4: テストが通ることを確認**

```
npx vitest run src/hooks/useAddMusicLink.test.ts
```
期待: 全テスト PASS

- [ ] **Step 5: コミット**

```bash
git add src/hooks/useAddMusicLink.ts src/hooks/useAddMusicLink.test.ts
git commit -m "feat: useAddMusicLink に addLinks バッチ INSERT を追加"
```

---

### Task 3: MusicPanel プレイリスト対応

**Files:**
- Modify: `src/components/MusicPanel.tsx`
- Modify: `src/components/MusicPanel.test.tsx`

- [ ] **Step 1: MusicPanel.test.tsx のモックとテストを追加**

**1a.** `vi.hoisted(...)` の戻り値オブジェクトに以下を追加:

```ts
  mockAddLinks: vi.fn(),
  mockFetchPlaylistItems: vi.fn(),
  mockPlaylistError: { value: null as string | null },
```

**1b.** destructure 宣言（先頭 `const { ... } = vi.hoisted(...)` の行）に追加:

```ts
  mockAddLinks, mockFetchPlaylistItems, mockPlaylistError,
```

**1c.** `vi.mock('../hooks/useAddMusicLink', ...)` を以下に更新（`addLinks` を追加）:

```ts
vi.mock('../hooks/useAddMusicLink', () => ({
  useAddMusicLink: () => ({
    addLink: mockAddLink,
    addLinks: mockAddLinks,
    deleteLink: mockDeleteLink,
    loading: false,
    error: mockError.value,
  }),
}))
```

**1d.** 既存の `vi.mock` 群の末尾に追加:

```ts
vi.mock('../hooks/usePlaylistItems', () => ({
  usePlaylistItems: () => ({
    fetchPlaylistItems: mockFetchPlaylistItems,
    error: mockPlaylistError.value,
  }),
}))
```

**1e.** `beforeEach` の `vi.clearAllMocks()` 直後に追加:

```ts
    mockAddLinks.mockResolvedValue(true)
    mockFetchPlaylistItems.mockResolvedValue([])
    mockPlaylistError.value = null
```

**1f.** `describe('MusicPanel', ...)` ブロックの閉じ `})` の直前に新 describe を追加:

```ts
  describe('URL入力タブ - プレイリスト対応', () => {
    const switchToUrlTab = async () => {
      await userEvent.click(screen.getByRole('tab', { name: 'URL入力' }))
    }

    it('プレイリストURLで末尾に追加: fetchPlaylistItems を呼び addLinks を呼ぶ（addLink は呼ばない）', async () => {
      mockFetchPlaylistItems.mockResolvedValue([
        { videoId: 'vid-1', title: '動画1' },
        { videoId: 'vid-2', title: '動画2' },
      ])
      render(<MusicPanel sessionId="sess-1" currentUserId="uid-me" />)
      await switchToUrlTab()
      await userEvent.type(
        screen.getByPlaceholderText('YouTube / YouTube Music URL'),
        'https://www.youtube.com/playlist?list=PLxxx'
      )
      await userEvent.click(screen.getByRole('button', { name: '末尾に追加' }))
      await waitFor(() => expect(mockFetchPlaylistItems).toHaveBeenCalledWith('PLxxx'))
      expect(mockAddLinks).toHaveBeenCalledWith(
        'sess-1',
        [
          { url: 'https://www.youtube.com/watch?v=vid-1', title: '動画1' },
          { url: 'https://www.youtube.com/watch?v=vid-2', title: '動画2' },
        ],
        'tail',
        undefined,
        undefined
      )
      expect(mockAddLink).not.toHaveBeenCalled()
    })

    it('プレイリスト取得中に「プレイリスト取得中...」を表示する', async () => {
      let resolveItems!: (v: { videoId: string; title: string }[]) => void
      mockFetchPlaylistItems.mockReturnValue(
        new Promise(resolve => { resolveItems = resolve })
      )
      render(<MusicPanel sessionId="sess-1" currentUserId="uid-me" />)
      await switchToUrlTab()
      await userEvent.type(
        screen.getByPlaceholderText('YouTube / YouTube Music URL'),
        'https://www.youtube.com/playlist?list=PLxxx'
      )
      act(() => { void userEvent.click(screen.getByRole('button', { name: '末尾に追加' })) })
      await waitFor(() =>
        expect(screen.getByText('プレイリスト取得中...')).toBeInTheDocument()
      )
      await act(async () => { resolveItems([]) })
    })

    it('プレイリスト追加中に「N件をキューに追加中...」を表示する', async () => {
      mockFetchPlaylistItems.mockResolvedValue([
        { videoId: 'vid-1', title: '動画1' },
        { videoId: 'vid-2', title: '動画2' },
      ])
      let resolveLinks!: (v: boolean) => void
      mockAddLinks.mockReturnValue(new Promise(resolve => { resolveLinks = resolve }))
      render(<MusicPanel sessionId="sess-1" currentUserId="uid-me" />)
      await switchToUrlTab()
      await userEvent.type(
        screen.getByPlaceholderText('YouTube / YouTube Music URL'),
        'https://www.youtube.com/playlist?list=PLxxx'
      )
      act(() => { void userEvent.click(screen.getByRole('button', { name: '末尾に追加' })) })
      await waitFor(() =>
        expect(screen.getByText('2件をキューに追加中...')).toBeInTheDocument()
      )
      await act(async () => { resolveLinks(true) })
    })

    it('プレイリスト追加成功後: URL入力フィールドがクリアされる', async () => {
      mockFetchPlaylistItems.mockResolvedValue([{ videoId: 'vid-1', title: '動画1' }])
      render(<MusicPanel sessionId="sess-1" currentUserId="uid-me" />)
      await switchToUrlTab()
      const input = screen.getByPlaceholderText('YouTube / YouTube Music URL')
      await userEvent.type(input, 'https://www.youtube.com/playlist?list=PLxxx')
      await userEvent.click(screen.getByRole('button', { name: '末尾に追加' }))
      await waitFor(() => expect(input).toHaveValue(''))
    })

    it('プレイリストが空のとき error を表示する', async () => {
      mockFetchPlaylistItems.mockImplementation(async () => {
        mockPlaylistError.value = 'プレイリストに動画がありません'
        return null
      })
      const { rerender } = render(<MusicPanel sessionId="sess-1" currentUserId="uid-me" />)
      await switchToUrlTab()
      await userEvent.type(
        screen.getByPlaceholderText('YouTube / YouTube Music URL'),
        'https://www.youtube.com/playlist?list=PLxxx'
      )
      await userEvent.click(screen.getByRole('button', { name: '末尾に追加' }))
      rerender(<MusicPanel sessionId="sess-1" currentUserId="uid-me" />)
      await waitFor(() =>
        expect(screen.getByRole('alert')).toHaveTextContent('プレイリストに動画がありません')
      )
    })

    it('watch?v=xxx&list=yyy は addLink を呼ぶ（プレイリスト展開しない）', async () => {
      render(<MusicPanel sessionId="sess-1" currentUserId="uid-me" />)
      await switchToUrlTab()
      await userEvent.type(
        screen.getByPlaceholderText('YouTube / YouTube Music URL'),
        'https://www.youtube.com/watch?v=abc&list=PLxxx'
      )
      await userEvent.click(screen.getByRole('button', { name: '末尾に追加' }))
      await waitFor(() => expect(mockAddLink).toHaveBeenCalled())
      expect(mockFetchPlaylistItems).not.toHaveBeenCalled()
    })
  })
```

- [ ] **Step 2: テストが失敗することを確認**

```
npx vitest run src/components/MusicPanel.test.tsx
```
期待: `URL入力タブ - プレイリスト対応` 内のテストが FAIL

- [ ] **Step 3: MusicPanel.tsx を更新**

**3a.** 既存の import 群の末尾に追加:

```ts
import { usePlaylistItems } from '../hooks/usePlaylistItems'
```

**3b.** `const { addLink, deleteLink, loading, error } = useAddMusicLink()` を以下に変更:

```ts
  const { addLink, addLinks, deleteLink, loading, error } = useAddMusicLink()
```

**3c.** `const { title: fetchedTitle, ... } = useYouTubeVideoTitle()` の行の直後に追加:

```ts
  const { fetchPlaylistItems, error: playlistError } = usePlaylistItems()
```

**3d.** `const [urlInput, setUrlInput] = useState('')` の直後に追加:

```ts
  const [playlistProgress, setPlaylistProgress] = useState<{ phase: 'fetching' | 'inserting'; total: number } | null>(null)
```

**3e.** 既存の `handleAddFromUrl` 関数全体を以下に置き換え:

```ts
  const handleAddFromUrl = async (position: 'head' | 'tail') => {
    const videoId = extractYouTubeId(urlInput)
    const playlistId = extractPlaylistId(urlInput)

    if (playlistId && !videoId) {
      setPlaylistProgress({ phase: 'fetching', total: 0 })
      const items = await fetchPlaylistItems(playlistId)
      if (!items) {
        setPlaylistProgress(null)
        return
      }
      setPlaylistProgress({ phase: 'inserting', total: items.length })
      const musicItems = items.map(item => ({
        url: `https://www.youtube.com/watch?v=${item.videoId}`,
        title: item.title,
      }))
      const nextLink = position === 'head' ? links[currentIndex + 1] : undefined
      const ok = await addLinks(
        sessionId,
        musicItems,
        position,
        position === 'head' ? currentLink : undefined,
        nextLink
      )
      setPlaylistProgress(null)
      if (ok) setUrlInput('')
      return
    }

    const title = fetchedTitle ?? urlInput
    let ok: boolean
    if (position === 'head' && currentLink) {
      const nextLink = links[currentIndex + 1]
      const sortOrder = nextLink
        ? (currentLink.sort_order + nextLink.sort_order) / 2
        : currentLink.sort_order + 1000
      ok = await addLink(sessionId, urlInput, title, position, sortOrder)
    } else {
      ok = await addLink(sessionId, urlInput, title, position)
    }
    if (ok) {
      setUrlInput('')
      clearTitle()
    }
  }
```

**3f.** `<TabsContent value="url" ...>` 内の `{error && <p role="alert" ...>{error}</p>}` を以下に置き換え:

```tsx
            {playlistProgress && (
              <p className="text-camp-wheat text-xs">
                {playlistProgress.phase === 'fetching'
                  ? 'プレイリスト取得中...'
                  : `${playlistProgress.total}件をキューに追加中...`}
              </p>
            )}
            {(error ?? playlistError) && (
              <p role="alert" className="text-camp-destructive text-xs">{error ?? playlistError}</p>
            )}
```

- [ ] **Step 4: テストが通ることを確認**

```
npx vitest run src/components/MusicPanel.test.tsx
```
期待: 全テスト PASS

- [ ] **Step 5: 全テストが通ることを確認**

```
npx vitest run
```
期待: 全テスト PASS（既存テストに影響なし）

- [ ] **Step 6: コミット**

```bash
git add src/components/MusicPanel.tsx src/components/MusicPanel.test.tsx
git commit -m "feat: プレイリストURLをキューに展開して追加する機能を実装"
```
