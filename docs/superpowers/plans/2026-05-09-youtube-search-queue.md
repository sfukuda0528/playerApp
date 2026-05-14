# YouTube検索・キュー強化 実装計画

> **Codex 向け:** この計画は現在のセッションでタスクごとに実装してください。サブエージェントは、ユーザーが委任または並列作業を明示的に依頼し、かつアクティブな Codex 実行環境が許可している場合にのみ使用します。手順は追跡用にチェックボックス（`- [ ]`）形式を使用します。

**Goal:** MusicPanelにYouTube検索機能・先頭/末尾追加・ドラッグ並び替えを追加し、キューにタイトルを表示する。

**Architecture:** `music_links` テーブルに `title` と `sort_order float` を追加し順序管理する。YouTube Data API v3で検索、oEmbed APIでURLからタイトル取得、`@dnd-kit/sortable`でドラッグ並び替えを実装する。

**Tech Stack:** React 19, Supabase, YouTube Data API v3, YouTube oEmbed API, @dnd-kit/core, @dnd-kit/sortable, @radix-ui/react-tabs, Vitest, @testing-library/react

---

## ファイル変更一覧

| ファイル | 種別 |
|---------|------|
| `supabase/migrations/20260509000001_add_title_sort_order.sql` | 新規 |
| `src/types/session.ts` | 変更（`MusicLink`に`title`,`sort_order`追加） |
| `src/hooks/useMusicLinks.ts` | 変更（sort_order順、UPDATEイベント追加） |
| `src/hooks/useMusicLinks.test.ts` | 変更（フィクスチャ更新、UPDATEテスト追加） |
| `src/hooks/useAddMusicLink.ts` | 変更（`addLink`にtitle+position引数追加） |
| `src/hooks/useAddMusicLink.test.ts` | 変更（新シグネチャテスト） |
| `src/hooks/useYouTubeSearch.ts` | 新規 |
| `src/hooks/useYouTubeSearch.test.ts` | 新規 |
| `src/hooks/useYouTubeVideoTitle.ts` | 新規 |
| `src/hooks/useYouTubeVideoTitle.test.ts` | 新規 |
| `src/hooks/useReorderMusicLink.ts` | 新規 |
| `src/hooks/useReorderMusicLink.test.ts` | 新規 |
| `src/components/MusicPanel.tsx` | 変更（タブUI、検索、DnD） |
| `src/components/MusicPanel.test.tsx` | 変更（全面更新） |

---

## Task 1: DBマイグレーション

**Files:**
- Create: `supabase/migrations/20260509000001_add_title_sort_order.sql`

- [ ] **Step 1: マイグレーションファイルを作成**

```sql
-- music_links に title と sort_order を追加
ALTER TABLE public.music_links
  ADD COLUMN title text NOT NULL DEFAULT '',
  ADD COLUMN sort_order double precision NOT NULL DEFAULT 0;

-- 既存レコードの sort_order を created_at のエポック秒で初期化（挿入順を保持）
UPDATE public.music_links
  SET sort_order = EXTRACT(EPOCH FROM created_at);
```

- [ ] **Step 2: マイグレーション適用**

```bash
npx supabase db push
```

Expected: エラーなし

- [ ] **Step 3: コミット**

```bash
git add supabase/migrations/20260509000001_add_title_sort_order.sql
git commit -m "feat: music_links に title と sort_order カラムを追加"
```

---

## Task 2: MusicLink型を更新

**Files:**
- Modify: `src/types/session.ts`

- [ ] **Step 1: `MusicLink` インターフェースを更新**

`src/types/session.ts` の `MusicLink` を以下に変更:

```typescript
export interface MusicLink {
  id: string
  session_id: string
  added_by_auth_id: string
  url: string
  title: string
  sort_order: number
  created_at: string
}
```

- [ ] **Step 2: TypeScript エラー確認**

```bash
npx tsc --noEmit
```

Expected: `useMusicLinks.test.ts`・`useAddMusicLink.test.ts`・`MusicPanel.test.tsx` でフィクスチャの不足プロパティエラーが出る（Task 3〜9 で解消する）

- [ ] **Step 3: コミット**

```bash
git add src/types/session.ts
git commit -m "feat: MusicLink 型に title と sort_order を追加"
```

---

## Task 3: useMusicLinksをsort_order順・UPDATEイベント対応に更新

**Files:**
- Modify: `src/hooks/useMusicLinks.ts`
- Modify: `src/hooks/useMusicLinks.test.ts`

- [ ] **Step 1: テストファイル全体を以下に置き換え**

`src/hooks/useMusicLinks.test.ts`:

```typescript
import { renderHook, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useMusicLinks } from './useMusicLinks'
import type { MusicLink } from '../types/session'

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
    mockOn.mockImplementation((_event: string, _filter: unknown, handler: (payload: unknown) => void) => {
      handlers.push(handler)
      return { on: mockOn, subscribe: vi.fn() }
    })
    mockChannel.mockReturnValue({ on: mockOn })
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
    expect(onInsert).toHaveBeenCalledWith(link2)
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
```

- [ ] **Step 2: テストを実行して失敗を確認**

```bash
npx vitest run src/hooks/useMusicLinks.test.ts
```

Expected: FAIL（handlersインデックスのズレ、UPDATEハンドラ未実装）

- [ ] **Step 3: `useMusicLinks.ts` を以下に置き換え**

```typescript
import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { MusicLink } from '../types/session'

export function useMusicLinks(
  sessionId: string,
  options?: { onInsert?: (link: MusicLink) => void }
) {
  const [links, setLinks] = useState<MusicLink[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const onInsertRef = useRef(options?.onInsert)
  useEffect(() => { onInsertRef.current = options?.onInsert })

  useEffect(() => {
    let cancelled = false

    supabase
      .from('music_links')
      .select()
      .eq('session_id', sessionId)
      .order('sort_order', { ascending: true })
      .then(({ data, error: fetchError }) => {
        if (cancelled) return
        if (fetchError) { setError(fetchError.message); setLoading(false); return }
        if (data) setLinks(data as MusicLink[])
        setLoading(false)
      })

    const channel = supabase
      .channel(`music_links:${sessionId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'music_links', filter: `session_id=eq.${sessionId}` },
        (payload) => {
          const newLink = payload.new as MusicLink
          setLinks((prev) => [...prev, newLink].sort((a, b) => a.sort_order - b.sort_order))
          onInsertRef.current?.(newLink)
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'music_links', filter: `session_id=eq.${sessionId}` },
        (payload) => {
          const updated = payload.new as MusicLink
          setLinks((prev) =>
            prev.map(l => l.id === updated.id ? updated : l)
              .sort((a, b) => a.sort_order - b.sort_order)
          )
        }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'music_links', filter: `session_id=eq.${sessionId}` },
        (payload) => setLinks((prev) => prev.filter((l) => l.id !== (payload.old as MusicLink).id))
      )
      .subscribe()

    return () => {
      cancelled = true
      supabase.removeChannel(channel)
    }
  }, [sessionId])

  return { links, loading, error }
}
```

- [ ] **Step 4: テストを実行してすべてパスを確認**

```bash
npx vitest run src/hooks/useMusicLinks.test.ts
```

Expected: PASS（10テスト）

- [ ] **Step 5: コミット**

```bash
git add src/hooks/useMusicLinks.ts src/hooks/useMusicLinks.test.ts
git commit -m "feat: useMusicLinks を sort_order 順・UPDATE イベント対応に更新"
```

---

## Task 4: useAddMusicLinkにtitle・position引数を追加

**Files:**
- Modify: `src/hooks/useAddMusicLink.ts`
- Modify: `src/hooks/useAddMusicLink.test.ts`

- [ ] **Step 1: テストファイル全体を以下に置き換え**

`src/hooks/useAddMusicLink.test.ts`:

```typescript
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
```

- [ ] **Step 2: テストを実行して失敗を確認**

```bash
npx vitest run src/hooks/useAddMusicLink.test.ts
```

Expected: FAIL（`addLink` シグネチャ不一致、`sort_order` 未計算）

- [ ] **Step 3: `useAddMusicLink.ts` を以下に置き換え**

```typescript
import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { normalizeMusicUrl } from '../utils/youtube'

const ALLOWED: RegExp[] = [
  /^https?:\/\/(www\.)?youtube\.com\/watch/,
  /^https?:\/\/youtu\.be\//,
  /^https?:\/\/(www\.)?youtube\.com\/playlist/,
]

export function isValidMusicUrl(url: string): boolean {
  return ALLOWED.some((re) => re.test(url))
}

export function useAddMusicLink() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const addLink = async (
    sessionId: string,
    url: string,
    title: string,
    position: 'head' | 'tail'
  ): Promise<boolean> => {
    setError(null)
    const normalized = normalizeMusicUrl(url)
    if (!isValidMusicUrl(normalized)) {
      setError('YouTube または YouTube Music の URL を入力してください')
      return false
    }
    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('認証が必要です')

      const { data: extremeLink } = await supabase
        .from('music_links')
        .select('sort_order')
        .eq('session_id', sessionId)
        .order('sort_order', { ascending: position === 'head' })
        .limit(1)
        .maybeSingle()

      const newSortOrder = extremeLink
        ? (position === 'tail' ? extremeLink.sort_order + 1000 : extremeLink.sort_order - 1000)
        : 0

      const { error: insertError } = await supabase
        .from('music_links')
        .insert({
          session_id: sessionId,
          added_by_auth_id: user.id,
          url: normalized,
          title,
          sort_order: newSortOrder,
        })
      if (insertError) throw insertError

      return true
    } catch (err) {
      setError(err instanceof Error ? err.message : '追加に失敗しました')
      return false
    } finally {
      setLoading(false)
    }
  }

  const deleteLink = async (linkId: string): Promise<boolean> => {
    setLoading(true)
    setError(null)
    try {
      const { error: deleteError } = await supabase.from('music_links').delete().eq('id', linkId)
      if (deleteError) throw deleteError
      return true
    } catch (err) {
      setError(err instanceof Error ? err.message : '削除に失敗しました')
      return false
    } finally {
      setLoading(false)
    }
  }

  return { addLink, deleteLink, loading, error }
}
```

- [ ] **Step 4: テストを実行してすべてパスを確認**

```bash
npx vitest run src/hooks/useAddMusicLink.test.ts
```

Expected: PASS

- [ ] **Step 5: コミット**

```bash
git add src/hooks/useAddMusicLink.ts src/hooks/useAddMusicLink.test.ts
git commit -m "feat: useAddMusicLink に title と position 引数を追加し sort_order を計算"
```

---

## Task 5: useYouTubeSearch フックを作成

**Files:**
- Create: `src/hooks/useYouTubeSearch.ts`
- Create: `src/hooks/useYouTubeSearch.test.ts`

- [ ] **Step 1: テストファイルを作成**

`src/hooks/useYouTubeSearch.test.ts`:

```typescript
import { renderHook, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { useYouTubeSearch } from './useYouTubeSearch'

const mockFetch = vi.fn()

beforeEach(() => {
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
```

- [ ] **Step 2: テストを実行して失敗を確認**

```bash
npx vitest run src/hooks/useYouTubeSearch.test.ts
```

Expected: FAIL（`useYouTubeSearch` が存在しない）

- [ ] **Step 3: `useYouTubeSearch.ts` を作成**

```typescript
import { useState } from 'react'

export interface VideoItem {
  videoId: string
  title: string
  thumbnail: string
}

export function useYouTubeSearch() {
  const [results, setResults] = useState<VideoItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const search = async (query: string) => {
    if (!query.trim()) return
    setLoading(true)
    setError(null)
    try {
      const apiKey = import.meta.env.VITE_YOUTUBE_API_KEY as string
      const params = new URLSearchParams({
        part: 'snippet',
        type: 'video',
        maxResults: '10',
        q: query,
        key: apiKey,
      })
      const res = await fetch(`https://www.googleapis.com/youtube/v3/search?${params}`)
      if (!res.ok) throw new Error(`YouTube API error: ${res.status}`)
      const json = await res.json() as {
        items: Array<{
          id: { videoId: string }
          snippet: { title: string; thumbnails: { medium?: { url: string } } }
        }>
      }
      setResults(
        json.items.map((item) => ({
          videoId: item.id.videoId,
          title: item.snippet.title,
          thumbnail:
            item.snippet.thumbnails.medium?.url ??
            `https://img.youtube.com/vi/${item.id.videoId}/mqdefault.jpg`,
        }))
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : '検索に失敗しました')
    } finally {
      setLoading(false)
    }
  }

  const clear = () => setResults([])

  return { results, loading, error, search, clear }
}
```

- [ ] **Step 4: テストを実行してすべてパスを確認**

```bash
npx vitest run src/hooks/useYouTubeSearch.test.ts
```

Expected: PASS

- [ ] **Step 5: コミット**

```bash
git add src/hooks/useYouTubeSearch.ts src/hooks/useYouTubeSearch.test.ts
git commit -m "feat: useYouTubeSearch フックを追加（YouTube Data API v3）"
```

---

## Task 6: useYouTubeVideoTitle フックを作成

**Files:**
- Create: `src/hooks/useYouTubeVideoTitle.ts`
- Create: `src/hooks/useYouTubeVideoTitle.test.ts`

- [ ] **Step 1: テストファイルを作成**

`src/hooks/useYouTubeVideoTitle.test.ts`:

```typescript
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
```

- [ ] **Step 2: テストを実行して失敗を確認**

```bash
npx vitest run src/hooks/useYouTubeVideoTitle.test.ts
```

Expected: FAIL（`useYouTubeVideoTitle` が存在しない）

- [ ] **Step 3: `useYouTubeVideoTitle.ts` を作成**

```typescript
import { useState } from 'react'

export function useYouTubeVideoTitle() {
  const [title, setTitle] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const fetchTitle = async (url: string) => {
    if (!url.trim()) return
    setLoading(true)
    try {
      const params = new URLSearchParams({ url, format: 'json' })
      const res = await fetch(`https://www.youtube.com/oembed?${params}`)
      if (!res.ok) throw new Error('title fetch failed')
      const json = await res.json() as { title: string }
      setTitle(json.title)
    } catch {
      setTitle(null)
    } finally {
      setLoading(false)
    }
  }

  const clear = () => setTitle(null)

  return { title, loading, fetchTitle, clear }
}
```

- [ ] **Step 4: テストを実行してすべてパスを確認**

```bash
npx vitest run src/hooks/useYouTubeVideoTitle.test.ts
```

Expected: PASS

- [ ] **Step 5: コミット**

```bash
git add src/hooks/useYouTubeVideoTitle.ts src/hooks/useYouTubeVideoTitle.test.ts
git commit -m "feat: useYouTubeVideoTitle フックを追加（oEmbed API）"
```

---

## Task 7: useReorderMusicLink フックを作成

**Files:**
- Create: `src/hooks/useReorderMusicLink.ts`
- Create: `src/hooks/useReorderMusicLink.test.ts`

- [ ] **Step 1: テストファイルを作成**

`src/hooks/useReorderMusicLink.test.ts`:

```typescript
import { renderHook, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useReorderMusicLink } from './useReorderMusicLink'

const mockUpdate = vi.fn()

vi.mock('../lib/supabase', () => ({
  supabase: {
    from: () => ({
      update: (data: unknown) => ({ eq: () => mockUpdate(data) }),
    }),
  },
}))

describe('useReorderMusicLink', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('reorder: UPDATE を { sort_order: newSortOrder } で呼び true を返す', async () => {
    mockUpdate.mockResolvedValue({ error: null })
    const { result } = renderHook(() => useReorderMusicLink())

    let ok: boolean | undefined
    await act(async () => {
      ok = await result.current.reorder('ml-1', 1500)
    })

    expect(ok).toBe(true)
    expect(mockUpdate).toHaveBeenCalledWith({ sort_order: 1500 })
  })

  it('DB エラーで false を返す', async () => {
    mockUpdate.mockResolvedValue({ error: new Error('DB error') })
    const { result } = renderHook(() => useReorderMusicLink())

    let ok: boolean | undefined
    await act(async () => {
      ok = await result.current.reorder('ml-1', 1500)
    })

    expect(ok).toBe(false)
  })
})
```

- [ ] **Step 2: テストを実行して失敗を確認**

```bash
npx vitest run src/hooks/useReorderMusicLink.test.ts
```

Expected: FAIL（`useReorderMusicLink` が存在しない）

- [ ] **Step 3: `useReorderMusicLink.ts` を作成**

```typescript
import { supabase } from '../lib/supabase'

export function useReorderMusicLink() {
  const reorder = async (linkId: string, newSortOrder: number): Promise<boolean> => {
    const { error } = await supabase
      .from('music_links')
      .update({ sort_order: newSortOrder })
      .eq('id', linkId)
    return !error
  }

  return { reorder }
}
```

- [ ] **Step 4: テストを実行してすべてパスを確認**

```bash
npx vitest run src/hooks/useReorderMusicLink.test.ts
```

Expected: PASS

- [ ] **Step 5: コミット**

```bash
git add src/hooks/useReorderMusicLink.ts src/hooks/useReorderMusicLink.test.ts
git commit -m "feat: useReorderMusicLink フックを追加（ドラッグ並び替え用）"
```

---

## Task 8: @dnd-kit パッケージをインストール

**Files:** なし（package.json・package-lock.json のみ）

- [ ] **Step 1: パッケージをインストール**

```bash
npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
```

Expected: エラーなし

- [ ] **Step 2: TypeScript 型チェック**

```bash
npx tsc --noEmit
```

Expected: `MusicPanel.test.tsx` の型エラーのみ（MusicLink フィクスチャに title・sort_order 不足）。他はエラーなし。

- [ ] **Step 3: コミット**

```bash
git add package.json package-lock.json
git commit -m "chore: @dnd-kit/core・sortable・utilities をインストール"
```

---

## Task 9: MusicPanel を全面更新（タブ・検索・DnD・タイトル表示）

**Files:**
- Modify: `src/components/MusicPanel.tsx`
- Modify: `src/components/MusicPanel.test.tsx`

- [ ] **Step 1: テストファイル全体を以下に置き換え**

`src/components/MusicPanel.test.tsx`:

```typescript
import { render, screen, waitFor, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import MusicPanel from './MusicPanel'
import type { MusicLink } from '../types/session'

const {
  mockAddLink, mockDeleteLink, mockLinks, mockYouTubePlayer,
  mockSearch, mockSearchResults, mockFetchTitle, mockFetchedTitle,
  mockReorder, capturedOptions, capturedOnDragEnd,
} = vi.hoisted(() => ({
  mockAddLink: vi.fn(),
  mockDeleteLink: vi.fn(),
  mockLinks: { value: [] as MusicLink[] },
  mockYouTubePlayer: vi.fn(),
  mockSearch: vi.fn(),
  mockSearchResults: { value: [] as Array<{ videoId: string; title: string; thumbnail: string }> },
  mockFetchTitle: vi.fn(),
  mockFetchedTitle: { value: null as string | null },
  mockReorder: vi.fn(),
  capturedOptions: { onInsert: undefined as ((link: MusicLink) => void) | undefined },
  capturedOnDragEnd: { fn: undefined as ((e: unknown) => void) | undefined },
}))

vi.mock('../hooks/useMusicLinks', () => ({
  useMusicLinks: (_sessionId: string, options?: { onInsert?: (link: MusicLink) => void }) => {
    capturedOptions.onInsert = options?.onInsert
    return { links: mockLinks.value, loading: false, error: null }
  },
}))

vi.mock('../hooks/useAddMusicLink', () => ({
  useAddMusicLink: () => ({
    addLink: mockAddLink,
    deleteLink: mockDeleteLink,
    loading: false,
    error: null,
  }),
}))

vi.mock('../hooks/useReorderMusicLink', () => ({
  useReorderMusicLink: () => ({ reorder: mockReorder }),
}))

vi.mock('../hooks/useYouTubeSearch', () => ({
  useYouTubeSearch: () => ({
    results: mockSearchResults.value,
    loading: false,
    error: null,
    search: mockSearch,
    clear: vi.fn(),
  }),
}))

vi.mock('../hooks/useYouTubeVideoTitle', () => ({
  useYouTubeVideoTitle: () => ({
    title: mockFetchedTitle.value,
    loading: false,
    fetchTitle: mockFetchTitle,
    clear: vi.fn(),
  }),
}))

vi.mock('./YouTubePlayer', () => ({
  default: mockYouTubePlayer,
}))

vi.mock('@dnd-kit/core', () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  DndContext: ({ children, onDragEnd }: any) => {
    capturedOnDragEnd.fn = onDragEnd
    return children
  },
  closestCenter: vi.fn(),
  PointerSensor: class {},
  useSensor: vi.fn(),
  useSensors: vi.fn(() => []),
}))

vi.mock('@dnd-kit/sortable', () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  SortableContext: ({ children }: any) => children,
  verticalListSortingStrategy: {},
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  useSortable: (_args: any) => ({
    attributes: {},
    listeners: {},
    setNodeRef: vi.fn(),
    transform: null,
    transition: null,
    isDragging: false,
  }),
  arrayMove: (arr: MusicLink[], from: number, to: number) => {
    const result = [...arr]
    result.splice(to, 0, result.splice(from, 1)[0])
    return result
  },
}))

vi.mock('@dnd-kit/utilities', () => ({
  CSS: { Transform: { toString: () => '' } },
}))

const link1: MusicLink = {
  id: 'ml-1', session_id: 'sess-1', added_by_auth_id: 'uid-me',
  url: 'https://youtu.be/dQw4w9WgXcQ', title: 'Never Gonna Give You Up',
  sort_order: 1000, created_at: '2026-04-26T10:00:00Z',
}
const link2: MusicLink = {
  id: 'ml-2', session_id: 'sess-1', added_by_auth_id: 'uid-other',
  url: 'https://youtu.be/abc1234', title: '別の動画',
  sort_order: 2000, created_at: '2026-04-26T10:01:00Z',
}
const playlistLink: MusicLink = {
  id: 'ml-pl', session_id: 'sess-1', added_by_auth_id: 'uid-me',
  url: 'https://www.youtube.com/playlist?list=PLxxx', title: 'プレイリスト',
  sort_order: 3000, created_at: '2026-04-26T10:02:00Z',
}

describe('MusicPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockLinks.value = []
    mockSearchResults.value = []
    mockFetchedTitle.value = null
    capturedOptions.onInsert = undefined
    capturedOnDragEnd.fn = undefined
    mockYouTubePlayer.mockImplementation(
      ({ videoId, isPlaying }: { videoId?: string; isPlaying: boolean }) => (
        <div data-testid="youtube-player" data-video-id={videoId} data-playing={String(isPlaying)} />
      )
    )
    mockAddLink.mockResolvedValue(true)
    mockDeleteLink.mockResolvedValue(true)
    mockReorder.mockResolvedValue(true)
  })

  describe('キュー表示', () => {
    it('links が空のとき YouTubePlayer は表示されない', () => {
      render(<MusicPanel sessionId="sess-1" currentUserId="uid-me" />)
      expect(screen.queryByTestId('youtube-player')).not.toBeInTheDocument()
    })

    it('links があるとき YouTubePlayer に videoId が渡る', () => {
      mockLinks.value = [link1]
      render(<MusicPanel sessionId="sess-1" currentUserId="uid-me" />)
      expect(screen.getByTestId('youtube-player')).toHaveAttribute('data-video-id', 'dQw4w9WgXcQ')
    })

    it('プレイリスト URL の link で playlistId が YouTubePlayer に渡る', () => {
      mockLinks.value = [playlistLink]
      render(<MusicPanel sessionId="sess-1" currentUserId="uid-me" />)
      expect(mockYouTubePlayer).toHaveBeenCalledWith(
        expect.objectContaining({ playlistId: 'PLxxx', videoId: undefined }),
        undefined
      )
    })

    it('キューにタイトルを表示する（URL ではなく）', () => {
      mockLinks.value = [link1]
      render(<MusicPanel sessionId="sess-1" currentUserId="uid-me" />)
      expect(screen.getByText('Never Gonna Give You Up')).toBeInTheDocument()
      expect(screen.queryByText(link1.url)).not.toBeInTheDocument()
    })

    it('キューアイテムにドラッグハンドルが表示される', () => {
      mockLinks.value = [link1]
      render(<MusicPanel sessionId="sess-1" currentUserId="uid-me" />)
      expect(screen.getByRole('button', { name: '並び替え' })).toBeInTheDocument()
    })

    it('先頭リンクに aria-current が付与される', () => {
      mockLinks.value = [link1, link2]
      render(<MusicPanel sessionId="sess-1" currentUserId="uid-me" />)
      const items = screen.getAllByRole('listitem')
      expect(items[0]).toHaveAttribute('aria-current', 'true')
      expect(items[1]).not.toHaveAttribute('aria-current', 'true')
    })

    it('自分のリンクには削除ボタンが表示される', () => {
      mockLinks.value = [link1]
      render(<MusicPanel sessionId="sess-1" currentUserId="uid-me" />)
      expect(screen.getByRole('button', { name: '削除' })).toBeInTheDocument()
    })

    it('他人のリンクには削除ボタンが表示されない', () => {
      mockLinks.value = [link2]
      render(<MusicPanel sessionId="sess-1" currentUserId="uid-me" />)
      expect(screen.queryByRole('button', { name: '削除' })).not.toBeInTheDocument()
    })

    it('削除ボタンクリックで deleteLink を呼ぶ', async () => {
      mockLinks.value = [link1]
      render(<MusicPanel sessionId="sess-1" currentUserId="uid-me" />)
      await userEvent.click(screen.getByRole('button', { name: '削除' }))
      expect(mockDeleteLink).toHaveBeenCalledWith('ml-1')
    })
  })

  describe('ドラッグ並び替え', () => {
    it('onDragEnd 発火で reorder を呼ぶ', async () => {
      mockLinks.value = [link1, link2]
      render(<MusicPanel sessionId="sess-1" currentUserId="uid-me" />)

      await act(async () => {
        capturedOnDragEnd.fn?.({ active: { id: 'ml-1' }, over: { id: 'ml-2' } })
      })

      await waitFor(() => expect(mockReorder).toHaveBeenCalledOnce())
      expect(mockReorder).toHaveBeenCalledWith('ml-1', expect.any(Number))
    })

    it('active と over が同じとき reorder を呼ばない', async () => {
      mockLinks.value = [link1, link2]
      render(<MusicPanel sessionId="sess-1" currentUserId="uid-me" />)

      await act(async () => {
        capturedOnDragEnd.fn?.({ active: { id: 'ml-1' }, over: { id: 'ml-1' } })
      })

      expect(mockReorder).not.toHaveBeenCalled()
    })
  })

  describe('検索タブ（デフォルト）', () => {
    it('初期表示で検索タブが表示される', () => {
      render(<MusicPanel sessionId="sess-1" currentUserId="uid-me" />)
      expect(screen.getByPlaceholderText('曲名・アーティスト名で検索')).toBeInTheDocument()
    })

    it('検索ボタンクリックで search を呼ぶ', async () => {
      render(<MusicPanel sessionId="sess-1" currentUserId="uid-me" />)
      await userEvent.type(screen.getByPlaceholderText('曲名・アーティスト名で検索'), 'テスト')
      await userEvent.click(screen.getByRole('button', { name: '🔍' }))
      expect(mockSearch).toHaveBeenCalledWith('テスト')
    })

    it('Enterキーで search を呼ぶ', async () => {
      render(<MusicPanel sessionId="sess-1" currentUserId="uid-me" />)
      await userEvent.type(screen.getByPlaceholderText('曲名・アーティスト名で検索'), 'テスト{Enter}')
      expect(mockSearch).toHaveBeenCalledWith('テスト')
    })

    it('検索結果にサムネイルとタイトルを表示する', () => {
      mockSearchResults.value = [
        { videoId: 'vid-1', title: '検索結果動画', thumbnail: 'https://example.com/thumb.jpg' },
      ]
      render(<MusicPanel sessionId="sess-1" currentUserId="uid-me" />)
      expect(screen.getByText('検索結果動画')).toBeInTheDocument()
      expect(screen.getByRole('img')).toHaveAttribute('src', 'https://example.com/thumb.jpg')
    })

    it('検索結果の「先頭」ボタンで addLink を position=head で呼ぶ', async () => {
      mockSearchResults.value = [
        { videoId: 'vid-1', title: '検索結果動画', thumbnail: '' },
      ]
      render(<MusicPanel sessionId="sess-1" currentUserId="uid-me" />)
      await userEvent.click(screen.getByRole('button', { name: '先頭' }))
      expect(mockAddLink).toHaveBeenCalledWith(
        'sess-1',
        'https://www.youtube.com/watch?v=vid-1',
        '検索結果動画',
        'head'
      )
    })

    it('検索結果の「末尾」ボタンで addLink を position=tail で呼ぶ', async () => {
      mockSearchResults.value = [
        { videoId: 'vid-1', title: '検索結果動画', thumbnail: '' },
      ]
      render(<MusicPanel sessionId="sess-1" currentUserId="uid-me" />)
      await userEvent.click(screen.getByRole('button', { name: '末尾' }))
      expect(mockAddLink).toHaveBeenCalledWith(
        'sess-1',
        'https://www.youtube.com/watch?v=vid-1',
        '検索結果動画',
        'tail'
      )
    })
  })

  describe('URL入力タブ', () => {
    const switchToUrlTab = async () => {
      await userEvent.click(screen.getByRole('tab', { name: 'URL入力' }))
    }

    it('URL入力 タブに切り替え可能', async () => {
      render(<MusicPanel sessionId="sess-1" currentUserId="uid-me" />)
      await switchToUrlTab()
      expect(screen.getByPlaceholderText('YouTube / YouTube Music URL')).toBeInTheDocument()
    })

    it('URL入力欄のblurで fetchTitle を呼ぶ', async () => {
      render(<MusicPanel sessionId="sess-1" currentUserId="uid-me" />)
      await switchToUrlTab()
      const input = screen.getByPlaceholderText('YouTube / YouTube Music URL')
      await userEvent.type(input, 'https://youtu.be/abc')
      await userEvent.tab()
      expect(mockFetchTitle).toHaveBeenCalledWith('https://youtu.be/abc')
    })

    it('取得済みタイトルを表示する', async () => {
      mockFetchedTitle.value = '取得されたタイトル'
      render(<MusicPanel sessionId="sess-1" currentUserId="uid-me" />)
      await switchToUrlTab()
      expect(screen.getByText(/取得されたタイトル/)).toBeInTheDocument()
    })

    it('「先頭に追加」クリックで addLink を position=head で呼ぶ', async () => {
      render(<MusicPanel sessionId="sess-1" currentUserId="uid-me" />)
      await switchToUrlTab()
      await userEvent.type(
        screen.getByPlaceholderText('YouTube / YouTube Music URL'),
        'https://youtu.be/abc'
      )
      await userEvent.click(screen.getByRole('button', { name: '先頭に追加' }))
      expect(mockAddLink).toHaveBeenCalledWith(
        'sess-1', 'https://youtu.be/abc', expect.any(String), 'head'
      )
    })

    it('「末尾に追加」クリックで addLink を position=tail で呼ぶ', async () => {
      render(<MusicPanel sessionId="sess-1" currentUserId="uid-me" />)
      await switchToUrlTab()
      await userEvent.type(
        screen.getByPlaceholderText('YouTube / YouTube Music URL'),
        'https://youtu.be/abc'
      )
      await userEvent.click(screen.getByRole('button', { name: '末尾に追加' }))
      expect(mockAddLink).toHaveBeenCalledWith(
        'sess-1', 'https://youtu.be/abc', expect.any(String), 'tail'
      )
    })

    it('追加成功後: URL入力フィールドがクリアされる', async () => {
      render(<MusicPanel sessionId="sess-1" currentUserId="uid-me" />)
      await switchToUrlTab()
      const input = screen.getByPlaceholderText('YouTube / YouTube Music URL')
      await userEvent.type(input, 'https://youtu.be/abc')
      await userEvent.click(screen.getByRole('button', { name: '末尾に追加' }))
      await waitFor(() => expect(input).toHaveValue(''))
    })
  })

  describe('再生状態', () => {
    it('handleEnded で deleteLink を呼ぶ', async () => {
      mockLinks.value = [link1, link2]
      render(<MusicPanel sessionId="sess-1" currentUserId="uid-me" />)
      const onEnded = mockYouTubePlayer.mock.calls[0][0].onEnded as () => Promise<void>
      await act(async () => { await onEnded() })
      expect(mockDeleteLink).toHaveBeenCalledWith('ml-1')
    })

    it('handleEnded 後 links 更新で次の曲が aria-current になる', async () => {
      mockLinks.value = [link1, link2]
      const { rerender } = render(<MusicPanel sessionId="sess-1" currentUserId="uid-me" />)
      const onEnded = mockYouTubePlayer.mock.calls[0][0].onEnded as () => Promise<void>
      await act(async () => { await onEnded() })
      mockLinks.value = [link2]
      rerender(<MusicPanel sessionId="sess-1" currentUserId="uid-me" />)
      expect(screen.getAllByRole('listitem')[0]).toHaveAttribute('aria-current', 'true')
    })

    it('INSERT 到着（未再生）で isPlaying が true になる', () => {
      mockLinks.value = [link1]
      render(<MusicPanel sessionId="sess-1" currentUserId="uid-me" />)
      expect(mockYouTubePlayer.mock.calls.at(-1)?.[0].isPlaying).toBe(false)
      act(() => { capturedOptions.onInsert?.(link2) })
      expect(mockYouTubePlayer.mock.calls.at(-1)?.[0].isPlaying).toBe(true)
    })

    it('INSERT 到着時: onMusicAdd コールバックを呼ぶ', () => {
      const onMusicAdd = vi.fn()
      mockLinks.value = [link1]
      render(<MusicPanel sessionId="sess-1" currentUserId="uid-me" onMusicAdd={onMusicAdd} />)
      act(() => { capturedOptions.onInsert?.(link2) })
      expect(onMusicAdd).toHaveBeenCalledWith(link2)
    })
  })
})
```

- [ ] **Step 2: テストを実行して失敗を確認**

```bash
npx vitest run src/components/MusicPanel.test.tsx
```

Expected: FAIL（`useReorderMusicLink`・`useYouTubeSearch`・`useYouTubeVideoTitle` インポートなし、タブなし等）

- [ ] **Step 3: `MusicPanel.tsx` を以下に置き換え**

```typescript
import { useEffect, useState } from 'react'
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors } from '@dnd-kit/core'
import type { DragEndEvent } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Tabs, TabsList, TabsTrigger, TabsContent } from './ui/tabs'
import { useMusicLinks } from '../hooks/useMusicLinks'
import { useAddMusicLink } from '../hooks/useAddMusicLink'
import { useReorderMusicLink } from '../hooks/useReorderMusicLink'
import { useYouTubeSearch } from '../hooks/useYouTubeSearch'
import { useYouTubeVideoTitle } from '../hooks/useYouTubeVideoTitle'
import YouTubePlayer from './YouTubePlayer'
import { extractYouTubeId, extractPlaylistId } from '../utils/youtube'
import type { MusicLink } from '../types/session'

interface Props {
  sessionId: string
  currentUserId: string
  onMusicAdd?: (link: MusicLink) => void
}

function SortableQueueItem({
  link, index, currentIndex, currentUserId, loading, onDelete,
}: {
  link: MusicLink
  index: number
  currentIndex: number
  currentUserId: string
  loading: boolean
  onDelete: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: link.id })
  const isCurrent = index === currentIndex
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 }}
      aria-current={isCurrent ? true : undefined}
      className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm ${
        isCurrent
          ? 'bg-camp-orange text-white'
          : 'bg-camp-warm-white border border-camp-wheat text-camp-dark'
      }`}
    >
      <button
        type="button"
        aria-label="並び替え"
        {...attributes}
        {...listeners}
        className="cursor-grab flex-shrink-0 opacity-40 hover:opacity-80"
      >
        ⠿
      </button>
      <span className="flex-1 truncate">{link.title || link.url}</span>
      {link.added_by_auth_id === currentUserId && (
        <button
          type="button"
          aria-label="削除"
          onClick={onDelete}
          disabled={loading}
          className="text-xs opacity-70 hover:opacity-100 flex-shrink-0"
        >
          ✕
        </button>
      )}
    </li>
  )
}

export default function MusicPanel({ sessionId, currentUserId, onMusicAdd }: Props) {
  const { links } = useMusicLinks(sessionId, {
    onInsert: (link) => {
      setIsPlaying((prev) => prev || true)
      onMusicAdd?.(link)
    },
  })
  const { addLink, deleteLink, loading, error } = useAddMusicLink()
  const { reorder } = useReorderMusicLink()
  const { results, loading: searchLoading, error: searchError, search } = useYouTubeSearch()
  const { title: fetchedTitle, loading: titleLoading, fetchTitle, clear: clearTitle } = useYouTubeVideoTitle()

  const [currentIndex, setCurrentIndex] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [urlInput, setUrlInput] = useState('')

  const sensors = useSensors(useSensor(PointerSensor))

  useEffect(() => {
    if (links.length === 0 || currentIndex >= links.length) {
      setIsPlaying(false)
      setCurrentIndex(0)
    }
  }, [links.length, currentIndex])

  const handleAddFromSearch = async (videoId: string, title: string, position: 'head' | 'tail') => {
    await addLink(sessionId, `https://www.youtube.com/watch?v=${videoId}`, title, position)
  }

  const handleAddFromUrl = async (position: 'head' | 'tail') => {
    const title = fetchedTitle ?? urlInput
    const ok = await addLink(sessionId, urlInput, title, position)
    if (ok) {
      setUrlInput('')
      clearTitle()
    }
  }

  const handleDelete = async (link: MusicLink, index: number) => {
    const isCurrent = index === currentIndex
    const ok = await deleteLink(link.id)
    if (!ok) return
    if (isCurrent) {
      setIsPlaying(false)
      setCurrentIndex(0)
    } else if (index < currentIndex) {
      setCurrentIndex((prev) => prev - 1)
    }
  }

  const handleEnded = async () => {
    if (!currentLink) return
    await deleteLink(currentLink.id)
  }

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const oldIndex = links.findIndex(l => l.id === active.id)
    const newIndex = links.findIndex(l => l.id === over.id)
    const sorted = arrayMove(links, oldIndex, newIndex)

    const prev = sorted[newIndex - 1]
    const next = sorted[newIndex + 1]

    let newSortOrder: number
    if (!prev && next) {
      newSortOrder = next.sort_order - 1000
    } else if (prev && !next) {
      newSortOrder = prev.sort_order + 1000
    } else if (prev && next) {
      newSortOrder = (prev.sort_order + next.sort_order) / 2
    } else {
      newSortOrder = 0
    }

    await reorder(active.id as string, newSortOrder)
  }

  const currentLink = links[currentIndex]
  const videoId = currentLink ? extractYouTubeId(currentLink.url) : null
  const playlistId = !videoId && currentLink ? extractPlaylistId(currentLink.url) : null

  return (
    <div className="flex flex-col h-full">
      <div className="bg-camp-dark px-4 py-4 flex flex-col gap-3">
        {(videoId || playlistId) ? (
          <YouTubePlayer
            key={currentLink?.id ?? 'empty'}
            videoId={videoId ?? undefined}
            playlistId={playlistId ?? undefined}
            isPlaying={isPlaying}
            onPlayToggle={() => setIsPlaying((p) => !p)}
            onEnded={handleEnded}
            onPrev={() => setCurrentIndex((prev) => (prev - 1 + links.length) % links.length)}
            onNext={() => setCurrentIndex((prev) => (prev + 1) % links.length)}
            hasPrev={links.length > 1}
            hasNext={links.length > 1}
          />
        ) : (
          <p className="text-camp-wheat/60 text-sm text-center py-2">曲がキューにありません</p>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-2">
        <span className="text-camp-amber text-xs font-bold uppercase tracking-wider">キュー</span>

        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={links.map(l => l.id)} strategy={verticalListSortingStrategy}>
            <ul className="flex flex-col gap-2">
              {links.map((link, index) => (
                <SortableQueueItem
                  key={link.id}
                  link={link}
                  index={index}
                  currentIndex={currentIndex}
                  currentUserId={currentUserId}
                  loading={loading}
                  onDelete={() => handleDelete(link, index)}
                />
              ))}
            </ul>
          </SortableContext>
        </DndContext>

        <Tabs defaultValue="search" className="mt-2">
          <TabsList className="w-full bg-camp-cream">
            <TabsTrigger value="search" className="flex-1 text-xs">検索</TabsTrigger>
            <TabsTrigger value="url" className="flex-1 text-xs">URL入力</TabsTrigger>
          </TabsList>

          <TabsContent value="search" className="flex flex-col gap-2 mt-2">
            <div className="flex gap-2">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') void search(searchQuery) }}
                placeholder="曲名・アーティスト名で検索"
                className="flex-1 bg-camp-cream border border-camp-wheat rounded-lg px-3 py-2 text-sm text-camp-dark outline-none focus:border-camp-orange"
              />
              <button
                type="button"
                onClick={() => void search(searchQuery)}
                disabled={searchLoading || !searchQuery.trim()}
                className="bg-camp-orange text-white text-sm font-bold px-3 py-2 rounded-lg disabled:opacity-40"
              >
                🔍
              </button>
            </div>
            {searchError && <p role="alert" className="text-camp-destructive text-xs">{searchError}</p>}
            <ul className="flex flex-col gap-1">
              {results.map((item) => (
                <li
                  key={item.videoId}
                  className="flex items-center gap-2 rounded-lg px-2 py-1 bg-camp-cream border border-camp-wheat"
                >
                  <img
                    src={item.thumbnail}
                    alt=""
                    className="w-12 h-9 object-cover rounded flex-shrink-0"
                  />
                  <span className="flex-1 text-xs text-camp-dark truncate">{item.title}</span>
                  <button
                    type="button"
                    onClick={() => void handleAddFromSearch(item.videoId, item.title, 'head')}
                    disabled={loading}
                    className="text-xs text-camp-orange font-bold px-2 py-1 rounded hover:bg-camp-orange/10 disabled:opacity-40 flex-shrink-0"
                  >
                    先頭
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleAddFromSearch(item.videoId, item.title, 'tail')}
                    disabled={loading}
                    className="text-xs text-camp-orange font-bold px-2 py-1 rounded hover:bg-camp-orange/10 disabled:opacity-40 flex-shrink-0"
                  >
                    末尾
                  </button>
                </li>
              ))}
            </ul>
          </TabsContent>

          <TabsContent value="url" className="flex flex-col gap-2 mt-2">
            <input
              type="text"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              onBlur={() => { if (urlInput) void fetchTitle(urlInput) }}
              placeholder="YouTube / YouTube Music URL"
              className="w-full bg-camp-cream border border-camp-wheat rounded-lg px-3 py-2 text-sm text-camp-dark outline-none focus:border-camp-orange"
            />
            {titleLoading && (
              <p className="text-camp-wheat text-xs">タイトル取得中...</p>
            )}
            {fetchedTitle && (
              <p className="text-camp-dark text-xs truncate">タイトル: {fetchedTitle}</p>
            )}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => void handleAddFromUrl('head')}
                disabled={loading || !urlInput.trim()}
                className="flex-1 bg-camp-orange text-white text-sm font-bold px-3 py-2 rounded-lg disabled:opacity-40"
              >
                先頭に追加
              </button>
              <button
                type="button"
                onClick={() => void handleAddFromUrl('tail')}
                disabled={loading || !urlInput.trim()}
                className="flex-1 bg-camp-orange text-white text-sm font-bold px-3 py-2 rounded-lg disabled:opacity-40"
              >
                末尾に追加
              </button>
            </div>
            {error && <p role="alert" className="text-camp-destructive text-xs">{error}</p>}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: テストを実行してすべてパスを確認**

```bash
npx vitest run src/components/MusicPanel.test.tsx
```

Expected: PASS

- [ ] **Step 5: 全テストを実行して既存テストへの影響がないことを確認**

```bash
npx vitest run
```

Expected: PASS（全テスト）

- [ ] **Step 6: TypeScript エラーがないことを確認**

```bash
npx tsc --noEmit
```

Expected: エラーなし

- [ ] **Step 7: コミット**

```bash
git add src/components/MusicPanel.tsx src/components/MusicPanel.test.tsx
git commit -m "feat: MusicPanel にYouTube検索・先頭末尾追加・ドラッグ並び替えを実装"
```
