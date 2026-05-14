# Host-Only Playback Implementation Plan

> **Codex 向け:** この計画は現在のセッションでタスクごとに実装してください。サブエージェントは、ユーザーが委任または並列作業を明示的に依頼し、かつアクティブな Codex 実行環境が許可している場合にのみ使用します。手順は追跡用にチェックボックス（`- [ ]`）形式を使用します。

**Goal:** 非ホストメンバーから YouTubePlayer（iframe＋再生コントロール）を非表示にし、キューへの追加は全員が利用可能にする。

**Architecture:** `MusicPanel` に `isHost?: boolean`（デフォルト `false`）を追加し、プレイヤーブロックを `{isHost && ...}` でガード。`MainPage` が既存の `isHost` state を渡すだけ。

**Tech Stack:** React + TypeScript, Vitest + Testing Library

---

### Task 1: 非ホスト用の失敗テストを書く

**Files:**
- Modify: `src/components/MusicPanel.test.tsx`

- [ ] **Step 1: 非ホスト describe ブロックを追加する**

`src/components/MusicPanel.test.tsx` の末尾（`})` の直前、`describe('レイアウト順序', ...)` の後）に以下を追加:

```tsx
  describe('非ホスト（isHost=false）', () => {
    it('links があっても YouTubePlayer が表示されない', () => {
      mockLinks.value = [link1]
      render(<MusicPanel sessionId="sess-1" currentUserId="uid-me" isHost={false} />)
      expect(screen.queryByTestId('youtube-player')).not.toBeInTheDocument()
    })

    it('検索タブが表示される', () => {
      render(<MusicPanel sessionId="sess-1" currentUserId="uid-me" isHost={false} />)
      expect(screen.getByPlaceholderText('曲名・アーティスト名で検索')).toBeInTheDocument()
    })

    it('キューが表示される', () => {
      mockLinks.value = [link1]
      render(<MusicPanel sessionId="sess-1" currentUserId="uid-me" isHost={false} />)
      expect(screen.getByText('Never Gonna Give You Up')).toBeInTheDocument()
    })
  })
```

- [ ] **Step 2: テストが失敗することを確認する**

```bash
npx vitest run src/components/MusicPanel.test.tsx --reporter=verbose 2>&1 | grep -A3 "非ホスト"
```

期待: `links があっても YouTubePlayer が表示されない` が FAIL（現状 `isHost` prop がなく player が常に表示される）

---

### Task 2: MusicPanel に isHost prop を実装する

**Files:**
- Modify: `src/components/MusicPanel.tsx`

- [ ] **Step 1: Props に isHost を追加し、プレイヤーブロックをガードする**

`src/components/MusicPanel.tsx` の Props interface を変更:

```ts
interface Props {
  sessionId: string
  currentUserId: string
  isHost?: boolean
  onMusicAdd?: (link: MusicLink) => void
}
```

関数シグネチャを変更:

```ts
export default function MusicPanel({ sessionId, currentUserId, isHost = false, onMusicAdd }: Props) {
```

プレイヤーブロック（`<div className="bg-camp-dark ...">` から `</div>` まで）を `{isHost && ...}` でラップ:

```tsx
      {isHost && (
        <div className="bg-camp-dark px-4 py-4 flex flex-col gap-3">
          {(videoId || playlistId) ? (
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
          ) : (
            <p className="text-camp-wheat/60 text-sm text-center py-2">曲がキューにありません</p>
          )}
          {skipToast && (
            <p role="status" className="text-camp-wheat text-xs text-center">再生できないためスキップしました</p>
          )}
        </div>
      )}
```

- [ ] **Step 2: 新しいテストがパスすることを確認する**

```bash
npx vitest run src/components/MusicPanel.test.tsx --reporter=verbose 2>&1 | grep -A2 "非ホスト"
```

期待: 3件すべて PASS

---

### Task 3: 既存の MusicPanel テストを修正する

**Files:**
- Modify: `src/components/MusicPanel.test.tsx`

既存テストは `isHost` を渡さない（デフォルト `false`）ため、YouTubePlayer を前提とするテストが失敗する。該当テストに `isHost={true}` を追加する。

- [ ] **Step 1: 失敗テストを特定する**

```bash
npx vitest run src/components/MusicPanel.test.tsx --reporter=verbose 2>&1 | grep "FAIL\|×"
```

期待: YouTubePlayer を参照するテスト複数件が FAIL

- [ ] **Step 2: "キュー表示" describe 内のプレイヤー関連テストを修正する**

以下3件の render に `isHost={true}` を追加:

```tsx
// "links が空のとき YouTubePlayer は表示されない"
render(<MusicPanel sessionId="sess-1" currentUserId="uid-me" isHost={true} />)

// "links があるとき YouTubePlayer に videoId が渡る"
mockLinks.value = [link1]
render(<MusicPanel sessionId="sess-1" currentUserId="uid-me" isHost={true} />)

// "プレイリスト URL の link で playlistId が YouTubePlayer に渡る"
mockLinks.value = [playlistLink]
render(<MusicPanel sessionId="sess-1" currentUserId="uid-me" isHost={true} />)
```

- [ ] **Step 3: "再生状態" describe 内の全テストを修正する**

`describe('再生状態', ...)` 内の全 `render(...)` に `isHost={true}` を追加（7件）:

```tsx
// "handleEnded で deleteLink を呼ぶ"
render(<MusicPanel sessionId="sess-1" currentUserId="uid-me" isHost={true} />)

// "handleEnded 後 links 更新で次の曲が aria-current になる"
const { rerender } = render(<MusicPanel sessionId="sess-1" currentUserId="uid-me" isHost={true} />)
// ...
rerender(<MusicPanel sessionId="sess-1" currentUserId="uid-me" isHost={true} />)

// "空キューに最初の曲が INSERT されたとき isPlaying が true になる"
render(<MusicPanel sessionId="sess-1" currentUserId="uid-me" isHost={true} />)

// "INSERT 到着（未再生）で isPlaying が true になる"
render(<MusicPanel sessionId="sess-1" currentUserId="uid-me" isHost={true} />)

// "INSERT 到着時: onMusicAdd コールバックを呼ぶ"
render(<MusicPanel sessionId="sess-1" currentUserId="uid-me" onMusicAdd={onMusicAdd} isHost={true} />)

// "先頭に INSERT されたとき currentIndex が +1 される..."
render(<MusicPanel sessionId="sess-1" currentUserId="uid-me" isHost={true} />)
// ...
rerender(<MusicPanel sessionId="sess-1" currentUserId="uid-me" isHost={true} />)

// "onError 発火で deleteLink を呼ぶ"
render(<MusicPanel sessionId="sess-1" currentUserId="uid-me" isHost={true} />)

// "onError 発火でスキップトーストが表示される"
render(<MusicPanel sessionId="sess-1" currentUserId="uid-me" isHost={true} />)

// "スキップトーストは3秒後に消える"
render(<MusicPanel sessionId="sess-1" currentUserId="uid-me" isHost={true} />)
```

- [ ] **Step 4: 全テストがパスすることを確認する**

```bash
npx vitest run src/components/MusicPanel.test.tsx --reporter=verbose 2>&1 | tail -5
```

期待: 全件 PASS、失敗 0

- [ ] **Step 5: コミット**

```bash
git add src/components/MusicPanel.tsx src/components/MusicPanel.test.tsx
git commit -m "feat: MusicPanel に isHost prop を追加しホスト以外のプレイヤーを非表示に"
```

---

### Task 4: MainPage から isHost を MusicPanel に渡す

**Files:**
- Modify: `src/components/MainPage.test.tsx`
- Modify: `src/components/MainPage.tsx`

- [ ] **Step 1: MainPage.test.tsx のモックと capturedProps を更新する**

`capturedMusicPanelProps` に `isHost` を追加:

```ts
capturedMusicPanelProps: { 
  onMusicAdd: undefined as ((link: MusicLink) => void) | undefined,
  isHost: undefined as boolean | undefined,
},
```

MusicPanel モックを更新して `isHost` をキャプチャ:

```tsx
vi.mock('./MusicPanel', () => ({
  default: ({ onMusicAdd, isHost }: { onMusicAdd?: (link: MusicLink) => void; isHost?: boolean }) => {
    capturedMusicPanelProps.onMusicAdd = onMusicAdd
    capturedMusicPanelProps.isHost = isHost
    return <div data-testid="music-panel" />
  },
}))
```

- [ ] **Step 2: isHost prop の失敗テストを追加する**

`describe('MainPage - ホスト', ...)` に追加:

```tsx
  it('MusicPanel に isHost=true が渡る', async () => {
    renderAsHost()
    await waitFor(() => expect(capturedMusicPanelProps.isHost).toBe(true))
  })
```

`describe('MainPage - 参加者', ...)` に追加:

```tsx
  it('MusicPanel に isHost=false が渡る', async () => {
    renderAsParticipant()
    await waitFor(() => expect(capturedMusicPanelProps.isHost).toBe(false))
  })
```

- [ ] **Step 3: テストが失敗することを確認する**

```bash
npx vitest run src/components/MainPage.test.tsx --reporter=verbose 2>&1 | grep -A2 "isHost"
```

期待: 2件 FAIL（現状 `isHost` prop が渡されていない）

- [ ] **Step 4: MainPage.tsx で isHost を渡す**

`src/components/MainPage.tsx` の MusicPanel 呼び出し箇所を変更:

```tsx
          {currentUserId && (
            <MusicPanel
              sessionId={sessionId!}
              currentUserId={currentUserId}
              isHost={isHost}
              onMusicAdd={handleMusicAdd}
            />
          )}
```

- [ ] **Step 5: 全テストがパスすることを確認する**

```bash
npx vitest run src/components/MainPage.test.tsx src/components/MusicPanel.test.tsx --reporter=verbose 2>&1 | tail -5
```

期待: 全件 PASS、失敗 0

- [ ] **Step 6: コミット**

```bash
git add src/components/MainPage.tsx src/components/MainPage.test.tsx
git commit -m "feat: MainPage から MusicPanel に isHost を渡す"
```
