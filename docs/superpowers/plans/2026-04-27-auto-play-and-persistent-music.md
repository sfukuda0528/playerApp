# 自動再生 & タブ跨ぎ音楽継続 実装計画

> **Codex 向け:** この計画は現在のセッションでタスクごとに実装してください。サブエージェントは、ユーザーが委任または並列作業を明示的に依頼し、かつアクティブな Codex 実行環境が許可している場合にのみ使用します。手順は追跡用にチェックボックス（`- [ ]`）形式を使用します。

**Goal:** YouTube リンク追加時に自動再生を開始し、タブ切り替え後も音楽が途切れないようにする

**Architecture:** `useMusicLinks` にリアルタイム INSERT 専用の `onInsert` コールバックを追加し、`MusicPanel` から functional setState で自動再生を起動する。`MainPage` の音楽タブに `forceMount` を付与し、YouTube iframe がアンマウントされないようにする。

**Tech Stack:** React 18, TypeScript, Radix UI Tabs, Supabase Realtime, Vitest, @testing-library/react

---

## ファイル対応表

| ファイル | 変更種別 | 内容 |
|---|---|---|
| `src/hooks/useMusicLinks.ts` | 修正 | `options?: { onInsert? }` 追加、refパターンで常に最新CB呼び出し |
| `src/hooks/useMusicLinks.test.ts` | 修正 | `onInsert` コールバックに関する3テスト追加 |
| `src/components/MusicPanel.tsx` | 修正 | `useMusicLinks` に `onInsert` を渡す（1行） |
| `src/components/MusicPanel.test.tsx` | 修正 | mock 更新 + 自動再生2テスト追加 |
| `src/components/MainPage.tsx` | 修正 | `TabsContent value="music"` に `forceMount` 追加 |
| `src/components/MainPage.test.tsx` | 修正 | 写真タブ中も music-panel が DOM に残るテスト追加 |

---

## Task 1: useMusicLinks に onInsert コールバックを追加

**Files:**
- Modify: `src/hooks/useMusicLinks.ts`
- Test: `src/hooks/useMusicLinks.test.ts`

- [ ] **Step 1: 失敗テストを追加する**

`src/hooks/useMusicLinks.test.ts` の `describe('useMusicLinks', ...)` ブロック末尾に以下を追加する（既存テストは変更しない）:

```ts
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

  handlers[1]({ old: { id: 'ml-1' } })
  await waitFor(() => expect(result.current.links).toHaveLength(0))
  expect(onInsert).not.toHaveBeenCalled()
})
```

- [ ] **Step 2: テストが失敗することを確認する**

```bash
npx vitest run src/hooks/useMusicLinks.test.ts
```

期待: 追加した3テストが FAIL（`onInsert` 引数が型エラーまたは呼ばれない）

- [ ] **Step 3: useMusicLinks.ts を更新する**

`src/hooks/useMusicLinks.ts` を以下に置き換える:

```ts
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
      .order('created_at', { ascending: true })
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
          setLinks((prev) => [...prev, newLink])
          onInsertRef.current?.(newLink)
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

- [ ] **Step 4: テストが通ることを確認する**

```bash
npx vitest run src/hooks/useMusicLinks.test.ts
```

期待: 全7テスト PASS

- [ ] **Step 5: コミットする**

```bash
git add src/hooks/useMusicLinks.ts src/hooks/useMusicLinks.test.ts
git commit -m "feat: add onInsert callback to useMusicLinks for realtime inserts only"
```

---

## Task 2: MusicPanel で自動再生を実装

**Files:**
- Modify: `src/components/MusicPanel.tsx`
- Test: `src/components/MusicPanel.test.tsx`

- [ ] **Step 1: MusicPanel.test.tsx の mock を更新し、失敗テストを追加する**

`src/components/MusicPanel.test.tsx` を開き、以下の2箇所を変更する。

**変更①**: `vi.hoisted` の戻り値に `capturedOptions` を追加する

```ts
const { mockAddLink, mockDeleteLink, mockLinks, mockYouTubePlayer, capturedOptions } = vi.hoisted(() => ({
  mockAddLink: vi.fn(),
  mockDeleteLink: vi.fn(),
  mockLinks: { value: [] as MusicLink[] },
  mockYouTubePlayer: vi.fn(),
  capturedOptions: { onInsert: undefined as ((link: MusicLink) => void) | undefined },
}))
```

**変更②**: `useMusicLinks` のモックを更新して `onInsert` を捕捉する

```ts
vi.mock('../hooks/useMusicLinks', () => ({
  useMusicLinks: (_sessionId: string, options?: { onInsert?: (link: MusicLink) => void }) => {
    capturedOptions.onInsert = options?.onInsert
    return { links: mockLinks.value, loading: false, error: null }
  },
}))
```

**変更③**: `beforeEach` 内に `capturedOptions.onInsert = undefined` をリセットする行を追加する

```ts
beforeEach(() => {
  vi.clearAllMocks()
  mockLinks.value = []
  capturedOptions.onInsert = undefined   // ← 追加
  mockYouTubePlayer.mockImplementation(
    ({ videoId, isPlaying }: { videoId: string; isPlaying: boolean }) => (
      <div data-testid="youtube-player" data-video-id={videoId} data-playing={String(isPlaying)} />
    )
  )
})
```

**変更④**: `describe('MusicPanel', ...)` ブロック末尾に失敗テストを追加する

```ts
it('INSERT 到着（未再生）で isPlaying が true になる', () => {
  mockLinks.value = [link1]
  render(<MusicPanel sessionId="sess-1" currentUserId="uid-me" />)
  expect(mockYouTubePlayer.mock.calls.at(-1)?.[0].isPlaying).toBe(false)
  act(() => { capturedOptions.onInsert?.(link2) })
  expect(mockYouTubePlayer.mock.calls.at(-1)?.[0].isPlaying).toBe(true)
})

it('INSERT 到着（再生中）で isPlaying は変化しない', () => {
  mockLinks.value = [link1]
  render(<MusicPanel sessionId="sess-1" currentUserId="uid-me" />)
  const onPlayToggle = mockYouTubePlayer.mock.calls[0][0].onPlayToggle as () => void
  act(() => { onPlayToggle() })
  expect(mockYouTubePlayer.mock.calls.at(-1)?.[0].isPlaying).toBe(true)
  act(() => { capturedOptions.onInsert?.(link2) })
  expect(mockYouTubePlayer.mock.calls.at(-1)?.[0].isPlaying).toBe(true)
})
```

- [ ] **Step 2: テストが失敗することを確認する**

```bash
npx vitest run src/components/MusicPanel.test.tsx
```

期待: 追加した2テストが FAIL（`capturedOptions.onInsert` が undefined のため `isPlaying` が変わらない）

- [ ] **Step 3: MusicPanel.tsx を更新する**

`src/components/MusicPanel.tsx` の `const { links }` 行を以下に置き換える:

```ts
const { links } = useMusicLinks(sessionId, {
  onInsert: () => setIsPlaying((prev) => prev || true),
})
```

- [ ] **Step 4: テストが通ることを確認する**

```bash
npx vitest run src/components/MusicPanel.test.tsx
```

期待: 全テスト PASS

- [ ] **Step 5: コミットする**

```bash
git add src/components/MusicPanel.tsx src/components/MusicPanel.test.tsx
git commit -m "feat: auto-play when new music link is added via realtime"
```

---

## Task 3: タブ切り替えで音楽が途切れないようにする

**Files:**
- Modify: `src/components/MainPage.tsx`
- Test: `src/components/MainPage.test.tsx`

- [ ] **Step 1: 失敗テストを追加する**

`src/components/MainPage.test.tsx` の `describe('MainPage - 参加者', ...)` ブロック末尾に追加する:

```ts
it('写真タブ表示中も MusicPanel が DOM に残る', async () => {
  renderAsParticipant()
  // photo-upload が表示された時点で currentUserId が解決済み
  await waitFor(() => expect(screen.getByTestId('photo-upload')).toBeInTheDocument())
  // forceMount により music-panel は写真タブ中も DOM にある
  expect(screen.getByTestId('music-panel')).toBeInTheDocument()
})
```

- [ ] **Step 2: テストが失敗することを確認する**

```bash
npx vitest run src/components/MainPage.test.tsx
```

期待: 追加したテストが FAIL（デフォルトでは音楽タブが非アクティブ時 MusicPanel はアンマウントされる）

- [ ] **Step 3: MainPage.tsx を更新する**

`src/components/MainPage.tsx` の `TabsContent value="music"` を以下に変更する:

```tsx
<TabsContent value="music" forceMount className="flex-1 overflow-y-auto mt-0">
```

変更箇所は `forceMount` の追加のみ。前後の行は変更しない。

- [ ] **Step 4: 全テストが通ることを確認する**

```bash
npx vitest run
```

期待: 全テスト PASS

- [ ] **Step 5: コミットする**

```bash
git add src/components/MainPage.tsx src/components/MainPage.test.tsx
git commit -m "feat: keep MusicPanel mounted across tabs for continuous audio playback"
```
