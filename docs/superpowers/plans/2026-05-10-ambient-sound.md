# 環境音自動再生 Implementation Plan

> **Codex 向け:** この計画は現在のセッションでタスクごとに実装してください。サブエージェントは、ユーザーが委任または並列作業を明示的に依頼し、かつアクティブな Codex 実行環境が許可している場合にのみ使用します。手順は追跡用にチェックボックス（`- [ ]`）形式を使用します。

**Goal:** キューが空かつホストのとき、昼/夜の時間帯に応じたYouTube環境音を自動ループ再生する。

**Architecture:** `getAmbientVideoId()` ユーティリティで時間帯を判定し、`AmbientPlayer` コンポーネントが react-youtube を直接使ってループ再生する。`MusicPanel` でキューが空のとき `YouTubePlayer` の代わりに `AmbientPlayer` を表示するだけで切り替えが実現する。

**Tech Stack:** React, react-youtube, vitest, @testing-library/react

---

## ファイル一覧

| 操作 | ファイル |
|---|---|
| 新規作成 | `src/utils/ambient.ts` |
| 新規作成 | `src/utils/ambient.test.ts` |
| 新規作成 | `src/components/AmbientPlayer.tsx` |
| 変更 | `src/components/MusicPanel.tsx` |
| 変更 | `src/components/MusicPanel.test.tsx` |

---

### Task 1: ambient ユーティリティを TDD で実装

**Files:**
- Create: `src/utils/ambient.ts`
- Create: `src/utils/ambient.test.ts`

- [ ] **Step 1: 失敗テストを書く**

`src/utils/ambient.test.ts` を新規作成:

```ts
import { describe, it, expect } from 'vitest'
import { getAmbientVideoId, AMBIENT_DAY_ID, AMBIENT_NIGHT_ID } from './ambient'

describe('getAmbientVideoId', () => {
  it('6:00 は昼IDを返す', () => {
    expect(getAmbientVideoId(new Date('2026-05-10T06:00:00'))).toBe(AMBIENT_DAY_ID)
  })
  it('17:59 は昼IDを返す', () => {
    expect(getAmbientVideoId(new Date('2026-05-10T17:59:00'))).toBe(AMBIENT_DAY_ID)
  })
  it('18:00 は夜IDを返す', () => {
    expect(getAmbientVideoId(new Date('2026-05-10T18:00:00'))).toBe(AMBIENT_NIGHT_ID)
  })
  it('5:59 は夜IDを返す', () => {
    expect(getAmbientVideoId(new Date('2026-05-10T05:59:00'))).toBe(AMBIENT_NIGHT_ID)
  })
  it('0:00 は夜IDを返す', () => {
    expect(getAmbientVideoId(new Date('2026-05-10T00:00:00'))).toBe(AMBIENT_NIGHT_ID)
  })
})
```

- [ ] **Step 2: テストが失敗することを確認**

```bash
npx vitest run src/utils/ambient.test.ts
```

Expected: `Cannot find module './ambient'` などのエラーで FAIL

- [ ] **Step 3: 実装を書く**

`src/utils/ambient.ts` を新規作成:

```ts
export const AMBIENT_DAY_ID = 'b7dAF4WYSyA'
export const AMBIENT_NIGHT_ID = 'kmythL1LppA'

export function getAmbientVideoId(now: Date = new Date()): string {
  const hour = now.getHours()
  return hour >= 6 && hour < 18 ? AMBIENT_DAY_ID : AMBIENT_NIGHT_ID
}
```

- [ ] **Step 4: テストが通ることを確認**

```bash
npx vitest run src/utils/ambient.test.ts
```

Expected: 5 tests PASS

- [ ] **Step 5: コミット**

```bash
git add src/utils/ambient.ts src/utils/ambient.test.ts
git commit -m "feat: getAmbientVideoId ユーティリティを追加（昼夜で動画ID切り替え）"
```

---

### Task 2: AmbientPlayer コンポーネントを実装

**Files:**
- Create: `src/components/AmbientPlayer.tsx`

テストなし（react-youtube のラッパーのみで実装ロジックなし）。

- [ ] **Step 1: コンポーネントを書く**

`src/components/AmbientPlayer.tsx` を新規作成:

```tsx
import YouTube from 'react-youtube'

interface Props {
  videoId: string
}

export default function AmbientPlayer({ videoId }: Props) {
  return (
    <YouTube
      videoId={videoId}
      opts={{
        width: '200',
        height: '113',
        playerVars: {
          autoplay: 1,
          loop: 1,
          playlist: videoId,
          controls: 0,
        },
      }}
    />
  )
}
```

`loop: 1` + `playlist: videoId` の組み合わせが YouTube IFrame API でループ再生を実現する条件。`controls: 0` でUIを非表示にする。

- [ ] **Step 2: 型チェック**

```bash
npx tsc --noEmit
```

Expected: エラーなし

- [ ] **Step 3: コミット**

```bash
git add src/components/AmbientPlayer.tsx
git commit -m "feat: AmbientPlayer コンポーネントを追加（YouTube環境音ループ再生）"
```

---

### Task 3: MusicPanel でキューが空のとき AmbientPlayer を表示（TDD）

**Files:**
- Modify: `src/components/MusicPanel.test.tsx`
- Modify: `src/components/MusicPanel.tsx`

- [ ] **Step 1: MusicPanel.test.tsx に AmbientPlayer のモックと失敗テストを追加**

`MusicPanel.test.tsx` の `vi.hoisted` ブロックの戻り値に `mockAmbientPlayer` を追加:

```ts
// vi.hoisted の戻り値オブジェクトに追加
mockAmbientPlayer: vi.fn(),
```

`vi.hoisted` の呼び出し部分（ファイル先頭）を次のように変更:

```ts
const {
  mockAddLink, mockDeleteLink, mockLinks, mockYouTubePlayer,
  mockSearch, mockSearchResults, mockFetchTitle, mockFetchedTitle,
  mockReorder, mockOptimisticReorder, capturedOptions, capturedOnDragEnd, mockError,
  mockAddLinks, mockFetchPlaylistItems, mockPlaylistError,
  mockAmbientPlayer,
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
  mockOptimisticReorder: vi.fn(),
  capturedOptions: { onInsert: undefined as ((link: MusicLink, prevLinks: MusicLink[]) => void) | undefined },
  capturedOnDragEnd: { fn: undefined as ((e: unknown) => void) | undefined },
  mockError: { value: null as string | null },
  mockAddLinks: vi.fn(),
  mockFetchPlaylistItems: vi.fn(),
  mockPlaylistError: { value: null as string | null },
  mockAmbientPlayer: vi.fn(),
}))
```

既存の `vi.mock('./YouTubePlayer', ...)` の直後に AmbientPlayer モックを追加:

```ts
vi.mock('./AmbientPlayer', () => ({
  default: mockAmbientPlayer,
}))
```

`beforeEach` ブロックに AmbientPlayer モック実装を追加（`mockYouTubePlayer.mockImplementation(...)` の直後）:

```ts
mockAmbientPlayer.mockImplementation(({ videoId }: { videoId: string }) => (
  <div data-testid="ambient-player" data-video-id={videoId} />
))
```

`describe('キュー表示', ...)` ブロック内の既存テストの後ろに新テストを追加:

```ts
it('isHost=true かつ links が空のとき AmbientPlayer が表示される', () => {
  render(<MusicPanel sessionId="sess-1" currentUserId="uid-me" isHost={true} />)
  expect(screen.getByTestId('ambient-player')).toBeInTheDocument()
})

it('isHost=true かつ links があるとき AmbientPlayer は表示されない', () => {
  mockLinks.value = [link1]
  render(<MusicPanel sessionId="sess-1" currentUserId="uid-me" isHost={true} />)
  expect(screen.queryByTestId('ambient-player')).not.toBeInTheDocument()
})

it('isHost=false かつ links が空のとき AmbientPlayer は表示されない', () => {
  render(<MusicPanel sessionId="sess-1" currentUserId="uid-me" isHost={false} />)
  expect(screen.queryByTestId('ambient-player')).not.toBeInTheDocument()
})
```

- [ ] **Step 2: テストが失敗することを確認**

```bash
npx vitest run src/components/MusicPanel.test.tsx
```

Expected: 追加した3テストが FAIL（`ambient-player` が見つからない）

- [ ] **Step 3: MusicPanel.tsx を変更**

ファイル先頭の import 群に以下を追加（`import YouTubePlayer` の直後）:

```ts
import AmbientPlayer from './AmbientPlayer'
import { getAmbientVideoId } from '../utils/ambient'
```

JSX 内の「曲がキューにありません」テキストを `AmbientPlayer` に置き換える。

変更箇所（MusicPanel.tsx の `isHost` ブロック内、YouTubePlayer の else 分岐）:

```tsx
// 変更前
) : (
  <p className="text-camp-wheat/60 text-sm text-center py-2">曲がキューにありません</p>
)}
```

```tsx
// 変更後
) : (
  <AmbientPlayer videoId={getAmbientVideoId()} />
)}
```

- [ ] **Step 4: テストが通ることを確認**

```bash
npx vitest run src/components/MusicPanel.test.tsx
```

Expected: 全テスト PASS

- [ ] **Step 5: 全テスト確認**

```bash
npx vitest run
```

Expected: 全テスト PASS

- [ ] **Step 6: 型チェック**

```bash
npx tsc --noEmit
```

Expected: エラーなし

- [ ] **Step 7: コミット**

```bash
git add src/components/MusicPanel.tsx src/components/MusicPanel.test.tsx
git commit -m "feat: キューが空のとき環境音を自動再生（AmbientPlayer）"
```
