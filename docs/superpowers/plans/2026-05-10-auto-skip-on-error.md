# 再生エラー時の自動スキップ機能 実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** YouTube 再生エラー（Premium限定・地域制限等）発生時に即座に次の曲へスキップし、3秒間トーストを表示する。

**Architecture:** `YouTubePlayer` に `onError` prop を追加してエラーを外部に通知。`MusicPanel` でエラーを受け取り、曲を即削除（→ 次の曲が自動再生）＋ローカルトースト表示。

**Tech Stack:** React 18, Vitest, @testing-library/react, react-youtube

---

### Task 1: YouTubePlayer テスト更新（TDD Red）

**Files:**
- Modify: `src/components/YouTubePlayer.test.tsx:111-169`

- [ ] **Step 1: 既存の playerError テスト3件を削除し、onError prop テストに置き換える**

`src/components/YouTubePlayer.test.tsx` の以下の3テストを削除する（`describe('YouTubePlayer')` ブロック内）：

削除対象（111〜169行）:
```
it('onError 発火でエラーメッセージ表示', ...
it('videoId 変更でエラーメッセージをリセット', ...
it('playlistId 変更でエラーメッセージをリセット', ...
```

代わりに以下の1テストを追加する（`it('playlistId が渡されたとき...'` の前）：

```ts
  it('onError 発火で onError prop を呼ぶ', () => {
    const onError = vi.fn()
    render(<YouTubePlayer {...baseProps} onError={onError} />)
    act(() => { ytProps.onError?.() })
    expect(onError).toHaveBeenCalledOnce()
  })
```

- [ ] **Step 2: テストを実行して FAIL を確認**

```
npx vitest run src/components/YouTubePlayer.test.tsx
```

期待結果: FAIL（`onError` prop が未定義のため `onError` が呼ばれない）

- [ ] **Step 3: コミット**

```bash
git add src/components/YouTubePlayer.test.tsx
git commit -m "test: YouTubePlayer の onError prop テストを追加（playerError state テストを削除）"
```

---

### Task 2: YouTubePlayer 実装更新（TDD Green）

**Files:**
- Modify: `src/components/YouTubePlayer.tsx`

- [ ] **Step 1: Props に onError を追加、playerError state を削除、実装を更新**

`src/components/YouTubePlayer.tsx` を以下に全置換する：

```tsx
import YouTube from 'react-youtube'
import { useEffect, useRef } from 'react'

interface Props {
  videoId?: string
  playlistId?: string
  isPlaying: boolean
  onPlayToggle: () => void
  onEnded: () => void
  onError?: () => void
  onPrev: () => void
  onNext: () => void
  hasPrev: boolean
  hasNext: boolean
}

export default function YouTubePlayer({
  videoId, playlistId, isPlaying, onPlayToggle, onEnded, onError, onPrev, onNext, hasPrev, hasNext,
}: Props) {
  const playerRef = useRef<{ playVideo: () => void; pauseVideo: () => void } | null>(null)

  useEffect(() => {
    const p = playerRef.current
    if (!p) return
    if (isPlaying) {
      p.playVideo()
    } else {
      p.pauseVideo()
    }
  }, [isPlaying])

  const playerVars = playlistId
    ? { autoplay: 0, list: playlistId, listType: 'playlist' as const }
    : { autoplay: 0 }

  return (
    <div>
      <YouTube
        videoId={videoId ?? ''}
        opts={{ width: '200', height: '113', playerVars }}
        onReady={(event) => {
          playerRef.current = event.target as { playVideo: () => void; pauseVideo: () => void }
          if (isPlaying) event.target.playVideo()
        }}
        onEnd={onEnded}
        onError={onError}
      />
      <div>
        <button onClick={onPrev} disabled={!hasPrev} aria-label="前へ">◀</button>
        <button onClick={onPlayToggle} aria-label={isPlaying ? '停止' : '再生'}>
          {isPlaying ? '⏸' : '▶'}
        </button>
        <button onClick={onNext} disabled={!hasNext} aria-label="次へ">▶▶</button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: テストを実行して PASS を確認**

```
npx vitest run src/components/YouTubePlayer.test.tsx
```

期待結果: 全テスト PASS

- [ ] **Step 3: コミット**

```bash
git add src/components/YouTubePlayer.tsx
git commit -m "feat: YouTubePlayer に onError prop を追加し playerError state を削除"
```

---

### Task 3: MusicPanel エラースキップのテスト追加（TDD Red）

**Files:**
- Modify: `src/components/MusicPanel.test.tsx`

- [ ] **Step 1: 再生状態 describe ブロクに エラースキップテストを追加**

`src/components/MusicPanel.test.tsx` の `describe('再生状態', ...)` ブロック内（`it('先頭に INSERT されたとき...')` の後）に以下のテストを追加する：

```ts
    it('onError 発火で deleteLink を呼ぶ', () => {
      mockLinks.value = [link1, link2]
      render(<MusicPanel sessionId="sess-1" currentUserId="uid-me" />)
      const onError = mockYouTubePlayer.mock.calls.at(-1)?.[0].onError as () => void
      act(() => { onError() })
      expect(mockDeleteLink).toHaveBeenCalledWith('ml-1')
    })

    it('onError 発火でスキップトーストが表示される', () => {
      mockLinks.value = [link1]
      render(<MusicPanel sessionId="sess-1" currentUserId="uid-me" />)
      const onError = mockYouTubePlayer.mock.calls.at(-1)?.[0].onError as () => void
      act(() => { onError() })
      expect(screen.getByRole('status')).toHaveTextContent('再生できないためスキップしました')
    })

    it('スキップトーストは3秒後に消える', () => {
      vi.useFakeTimers()
      mockLinks.value = [link1]
      render(<MusicPanel sessionId="sess-1" currentUserId="uid-me" />)
      const onError = mockYouTubePlayer.mock.calls.at(-1)?.[0].onError as () => void
      act(() => { onError() })
      expect(screen.getByRole('status')).toBeInTheDocument()
      act(() => { vi.advanceTimersByTime(3000) })
      expect(screen.queryByRole('status')).not.toBeInTheDocument()
      vi.useRealTimers()
    })
```

- [ ] **Step 2: テストを実行して FAIL を確認**

```
npx vitest run src/components/MusicPanel.test.tsx
```

期待結果: 追加した3テストが FAIL

- [ ] **Step 3: コミット**

```bash
git add src/components/MusicPanel.test.tsx
git commit -m "test: MusicPanel のエラースキップ動作テストを追加"
```

---

### Task 4: MusicPanel 実装更新（TDD Green）

**Files:**
- Modify: `src/components/MusicPanel.tsx`

- [ ] **Step 1: skipToast state と handleError を追加し、YouTubePlayer に onError を渡す**

`src/components/MusicPanel.tsx` の `const [playlistProgress, ...]` 行の直後に以下を追加する：

```ts
  const [skipToast, setSkipToast] = useState(false)
```

`handleEnded` 関数の直後（181行目付近）に以下を追加する：

```ts
  const handleError = () => {
    if (!currentLink) return
    setSkipToast(true)
    void deleteLink(currentLink.id)
    setTimeout(() => setSkipToast(false), 3000)
  }
```

`YouTubePlayer` コンポーネントの props に `onError={handleError}` を追加する（`onEnded={handleEnded}` の直後）：

```tsx
            <YouTubePlayer
              key={currentLink?.id ?? 'empty'}
              videoId={videoId ?? undefined}
              playlistId={playlistId ?? undefined}
              isPlaying={isPlaying}
              onPlayToggle={() => setIsPlaying((p) => !p)}
              onEnded={handleEnded}
              onError={handleError}
              onPrev={() => setCurrentIndex((prev) => (prev - 1 + links.length) % links.length)}
              onNext={handleEnded}
              hasPrev={links.length > 1}
              hasNext={links.length > 1}
            />
```

プレイヤーエリアの `</div>` 閉じタグの直前（`)}` の前）にトーストを追加する：

```tsx
        {skipToast && (
          <p role="status" className="text-camp-wheat text-xs text-center">再生できないためスキップしました</p>
        )}
```

具体的な位置はプレイヤーを囲む `<div className="bg-camp-dark px-4 py-4 flex flex-col gap-3">` ブロックの閉じ `</div>` の直前。

- [ ] **Step 2: テストを実行して PASS を確認**

```
npx vitest run src/components/MusicPanel.test.tsx
```

期待結果: 全テスト PASS

- [ ] **Step 3: 全テストを実行して回帰がないか確認**

```
npx vitest run
```

期待結果: 全テスト PASS

- [ ] **Step 4: コミット**

```bash
git add src/components/MusicPanel.tsx
git commit -m "feat: 再生エラー時に自動スキップしトーストを表示する"
```
