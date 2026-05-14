# スライドショー全画面表示 Implementation Plan

> **Codex 向け:** この計画は現在のセッションでタスクごとに実装してください。サブエージェントは、ユーザーが委任または並列作業を明示的に依頼し、かつアクティブな Codex 実行環境が許可している場合にのみ使用します。手順は追跡用にチェックボックス（`- [ ]`）形式を使用します。

**Goal:** スライドショー右下の ⛶ ボタンで Fullscreen API を使った全画面表示を実現し、全画面中に左右ナビゲーションと✕閉じるボタンを追加する。

**Architecture:** `src/components/Slideshow.tsx` のみを変更する。`useRef` で全画面対象要素を参照し、`fullscreenchange` イベントで `isFullscreen` state を同期する。手動ナビゲーション時は `manualNavCount` state をインクリメントして既存のタイマー `useEffect` を再実行させる。

**Tech Stack:** React 19 / TypeScript / Fullscreen API / Vitest + Testing Library

---

## File Map

| 操作 | ファイル |
|------|---------|
| Modify | `src/components/Slideshow.tsx` |
| Modify | `src/components/Slideshow.test.tsx` |

---

### Task 1: ⛶ ボタンと全画面起動

**Files:**
- Modify: `src/components/Slideshow.tsx`
- Modify: `src/components/Slideshow.test.tsx`

- [ ] **Step 1: テストに Fullscreen API モックの beforeEach/afterEach を追加する**

`src/components/Slideshow.test.tsx` の `describe('Slideshow', () => {` ブロックの `beforeEach`/`afterEach` を以下に差し替える：

```ts
beforeEach(() => {
  vi.useFakeTimers()
  HTMLElement.prototype.requestFullscreen = vi.fn().mockResolvedValue(undefined)
  document.exitFullscreen = vi.fn().mockResolvedValue(undefined)
  Object.defineProperty(document, 'fullscreenEnabled', {
    value: true, configurable: true, writable: true,
  })
  Object.defineProperty(document, 'fullscreenElement', {
    value: null, configurable: true, writable: true,
  })
})

afterEach(() => {
  vi.useRealTimers()
  Object.defineProperty(document, 'fullscreenElement', {
    value: null, configurable: true, writable: true,
  })
})
```

- [ ] **Step 2: ⛶ ボタン表示・非表示テストを書く**

`src/components/Slideshow.test.tsx` に以下を追加する（`describe` ブロック末尾）：

```ts
it('fullscreenEnabled=true: 写真あり時に⛶ボタンを表示する', async () => {
  await act(async () => {
    render(<Slideshow photos={[photo1, photo2]} />)
  })
  expect(screen.getByLabelText('全画面表示')).toBeInTheDocument()
})

it('fullscreenEnabled=false: ⛶ボタンを表示しない', async () => {
  Object.defineProperty(document, 'fullscreenEnabled', { value: false, configurable: true, writable: true })
  await act(async () => {
    render(<Slideshow photos={[photo1, photo2]} />)
  })
  expect(screen.queryByLabelText('全画面表示')).not.toBeInTheDocument()
})

it('⛶ボタンクリックで requestFullscreen が呼ばれる', async () => {
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
  await act(async () => {
    render(<Slideshow photos={[photo1, photo2]} />)
  })
  await user.click(screen.getByLabelText('全画面表示'))
  expect(HTMLElement.prototype.requestFullscreen).toHaveBeenCalledTimes(1)
})
```

- [ ] **Step 3: テストを実行して失敗を確認する**

```
npx vitest run src/components/Slideshow.test.tsx
```

期待: `fullscreenEnabled=true: 写真あり時に⛶ボタンを表示する` ほか 2 件が FAIL

- [ ] **Step 4: `Slideshow.tsx` に state/ref/handler/⛶ボタンを実装する**

`src/components/Slideshow.tsx` を以下のように変更する：

```ts
// インポートを変更（useRef を追加）
import { useState, useEffect, useRef } from 'react'
```

`export default function Slideshow` の先頭に以下を追加する：

```ts
const [isFullscreen, setIsFullscreen] = useState(false)
const [fullscreenEnabled] = useState(() => document.fullscreenEnabled ?? false)
const [manualNavCount, setManualNavCount] = useState(0)
const containerRef = useRef<HTMLDivElement>(null)

const handleFullscreen = () => {
  containerRef.current?.requestFullscreen().catch(console.error)
}
```

`photos.length === 0` の場合の早期 return は変更しない。

`photos.length > 0` の return ブロックで `<div aria-label="スライドショー"` に `ref={containerRef}` を追加する：

```tsx
<div ref={containerRef} aria-label="スライドショー" className="relative w-full aspect-video rounded-xl overflow-hidden bg-camp-wheat/40">
```

カウンター `<span>` と ⛶ボタンを下部 flex コンテナにまとめる（既存の `<span className="absolute bottom-2 right-2 ...">` を削除して以下に差し替える）：

```tsx
<div className="absolute bottom-2 right-2 flex items-center gap-1">
  <span className="bg-camp-dark/60 text-camp-cream text-xs px-2 py-0.5 rounded-full">
    {safeIndex + 1} / {photos.length}
  </span>
  {fullscreenEnabled && (
    <button
      aria-label="全画面表示"
      onClick={handleFullscreen}
      className="bg-camp-dark/60 text-camp-cream rounded-md w-6 h-6 flex items-center justify-center text-sm leading-none"
    >
      ⛶
    </button>
  )}
</div>
```

- [ ] **Step 5: テストを実行して通過を確認する**

```
npx vitest run src/components/Slideshow.test.tsx
```

期待: 全テスト PASS

- [ ] **Step 6: コミットする**

```bash
git add src/components/Slideshow.tsx src/components/Slideshow.test.tsx
git commit -m "feat: Slideshowに⛶全画面ボタンを追加"
```

---

### Task 2: fullscreenchange 同期・全画面UI・✕ボタン

**Files:**
- Modify: `src/components/Slideshow.tsx`
- Modify: `src/components/Slideshow.test.tsx`

- [ ] **Step 1: 全画面UI切り替えテストを書く**

`src/components/Slideshow.test.tsx` に以下を追加する。ファイル先頭に `userEvent` のインポートも追加する：

```ts
import userEvent from '@testing-library/user-event'
```

`describe` ブロック末尾に追加：

```ts
const enterFullscreen = async (slideshow: HTMLElement) => {
  Object.defineProperty(document, 'fullscreenElement', {
    value: slideshow, configurable: true, writable: true,
  })
  await act(async () => {
    document.dispatchEvent(new Event('fullscreenchange'))
  })
}

it('全画面時: ✕ボタン・左右ナビが表示される', async () => {
  await act(async () => {
    render(<Slideshow photos={[photo1, photo2]} />)
  })
  const slideshow = screen.getByLabelText('スライドショー')
  await enterFullscreen(slideshow)
  expect(screen.getByLabelText('全画面を閉じる')).toBeInTheDocument()
  expect(screen.getByLabelText('前の写真')).toBeInTheDocument()
  expect(screen.getByLabelText('次の写真')).toBeInTheDocument()
  expect(screen.queryByLabelText('全画面表示')).not.toBeInTheDocument()
})

it('✕クリックで exitFullscreen が呼ばれる', async () => {
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
  await act(async () => {
    render(<Slideshow photos={[photo1, photo2]} />)
  })
  const slideshow = screen.getByLabelText('スライドショー')
  await enterFullscreen(slideshow)
  await user.click(screen.getByLabelText('全画面を閉じる'))
  expect(document.exitFullscreen).toHaveBeenCalledTimes(1)
})
```

- [ ] **Step 2: テストを実行して失敗を確認する**

```
npx vitest run src/components/Slideshow.test.tsx
```

期待: `全画面時: ✕ボタン・左右ナビが表示される` など 2 件が FAIL

- [ ] **Step 3: fullscreenchange リスナーと全画面UIを実装する**

`src/components/Slideshow.tsx` の既存 `useEffect` 群の後に以下を追加する：

```ts
useEffect(() => {
  const handler = () => setIsFullscreen(!!document.fullscreenElement)
  document.addEventListener('fullscreenchange', handler)
  return () => document.removeEventListener('fullscreenchange', handler)
}, [])

const handleExitFullscreen = () => {
  document.exitFullscreen().catch(console.error)
}
```

`return` ブロック内、`<img>` タグの後（カウンター flex コンテナの前）に全画面UIを追加する：

```tsx
{isFullscreen && (
  <>
    <button
      aria-label="全画面を閉じる"
      onClick={handleExitFullscreen}
      className="absolute top-2 right-2 bg-black/60 text-white rounded-md w-8 h-8 flex items-center justify-center text-base leading-none"
    >
      ✕
    </button>
    <span className="absolute top-2 left-2 bg-black/60 text-white text-xs px-2 py-0.5 rounded-full">
      {safeIndex + 1} / {photos.length}
    </span>
    <button
      aria-label="前の写真"
      onClick={() => {}}
      className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/50 text-white rounded-full w-9 h-9 flex items-center justify-center text-lg leading-none"
    >
      ‹
    </button>
    <button
      aria-label="次の写真"
      onClick={() => {}}
      className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/50 text-white rounded-full w-9 h-9 flex items-center justify-center text-lg leading-none"
    >
      ›
    </button>
    <span className="absolute bottom-3 left-0 right-0 text-center text-white/40 text-xs">
      自動スライド継続中
    </span>
  </>
)}
```

全画面中は通常の flex カウンター+⛶ ボタンコンテナを非表示にするため、Task 1 で追加した `<div className="absolute bottom-2 right-2 ...">` を以下に変更する：

```tsx
{!isFullscreen && (
  <div className="absolute bottom-2 right-2 flex items-center gap-1">
    <span className="bg-camp-dark/60 text-camp-cream text-xs px-2 py-0.5 rounded-full">
      {safeIndex + 1} / {photos.length}
    </span>
    {fullscreenEnabled && (
      <button
        aria-label="全画面表示"
        onClick={handleFullscreen}
        className="bg-camp-dark/60 text-camp-cream rounded-md w-6 h-6 flex items-center justify-center text-sm leading-none"
      >
        ⛶
      </button>
    )}
  </div>
)}
```

- [ ] **Step 4: テストを実行して通過を確認する**

```
npx vitest run src/components/Slideshow.test.tsx
```

期待: 全テスト PASS

- [ ] **Step 5: コミットする**

```bash
git add src/components/Slideshow.tsx src/components/Slideshow.test.tsx
git commit -m "feat: 全画面UI（✕ボタン・左右ナビ枠）を追加"
```

---

### Task 3: 左右ナビゲーション＋タイマーリセット

**Files:**
- Modify: `src/components/Slideshow.tsx`
- Modify: `src/components/Slideshow.test.tsx`

- [ ] **Step 1: ナビゲーションとタイマーリセットのテストを書く**

`src/components/Slideshow.test.tsx` の `describe` ブロック末尾に追加する。`enterFullscreen` ヘルパーは Task 2 で定義済みなので再利用する（ただしテストファイル内でスコープが `describe` の外に出てしまう場合は内側に移動すること）：

```ts
it('‹クリックで前の写真に移動する', async () => {
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
  await act(async () => {
    render(<Slideshow photos={[photo1, photo2]} />)
  })
  // まず自動で photo2 へ進める
  act(() => { vi.advanceTimersByTime(5000) })
  expect(screen.getByRole('img')).toHaveAttribute('src', 'https://example.com/sess-1/002_b.jpg')
  // 全画面に入る
  const slideshow = screen.getByLabelText('スライドショー')
  await enterFullscreen(slideshow)
  // ‹ クリックで photo1 へ戻る
  await user.click(screen.getByLabelText('前の写真'))
  expect(screen.getByRole('img')).toHaveAttribute('src', 'https://example.com/sess-1/001_a.jpg')
})

it('›クリックで次の写真に移動する', async () => {
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
  await act(async () => {
    render(<Slideshow photos={[photo1, photo2]} />)
  })
  const slideshow = screen.getByLabelText('スライドショー')
  await enterFullscreen(slideshow)
  await user.click(screen.getByLabelText('次の写真'))
  expect(screen.getByRole('img')).toHaveAttribute('src', 'https://example.com/sess-1/002_b.jpg')
})

it('手動スキップ後: 5秒タイマーがリセットされる', async () => {
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
  await act(async () => {
    render(<Slideshow photos={[photo1, photo2]} />)
  })
  const slideshow = screen.getByLabelText('スライドショー')
  await enterFullscreen(slideshow)

  // 3秒進める（まだ photo1）
  act(() => { vi.advanceTimersByTime(3000) })
  expect(screen.getByRole('img')).toHaveAttribute('src', 'https://example.com/sess-1/001_a.jpg')

  // › クリックで photo2 へ（タイマーリセット）
  await user.click(screen.getByLabelText('次の写真'))
  expect(screen.getByRole('img')).toHaveAttribute('src', 'https://example.com/sess-1/002_b.jpg')

  // さらに 3 秒（合計 6 秒経過しているが、リセット後 3 秒なので切り替わらない）
  act(() => { vi.advanceTimersByTime(3000) })
  expect(screen.getByRole('img')).toHaveAttribute('src', 'https://example.com/sess-1/002_b.jpg')

  // さらに 2 秒（リセット後 5 秒 → photo1 へ戻る）
  act(() => { vi.advanceTimersByTime(2000) })
  expect(screen.getByRole('img')).toHaveAttribute('src', 'https://example.com/sess-1/001_a.jpg')
})
```

- [ ] **Step 2: テストを実行して失敗を確認する**

```
npx vitest run src/components/Slideshow.test.tsx
```

期待: `‹クリックで前の写真に移動する` ほか 2 件が FAIL（ボタンのハンドラが空のため）

- [ ] **Step 3: handlePrev / handleNext と manualNavCount を実装する**

`src/components/Slideshow.tsx` の `handleExitFullscreen` の後に追加する：

```ts
const handlePrev = () => {
  setCurrentIndex((prev) => (prev - 1 + photos.length) % photos.length)
  setManualNavCount((c) => c + 1)
}

const handleNext = () => {
  setCurrentIndex((prev) => (prev + 1) % photos.length)
  setManualNavCount((c) => c + 1)
}
```

タイマー `useEffect` の依存配列を更新する（`[photos.length]` → `[photos.length, manualNavCount]`）：

```ts
useEffect(() => {
  if (photos.length === 0) return
  const timer = setInterval(() => {
    setCurrentIndex((prev) => (prev + 1) % photos.length)
  }, 5000)
  return () => clearInterval(timer)
}, [photos.length, manualNavCount])
```

Task 2 で追加した `‹` / `›` ボタンの `onClick={() => {}}` を正しいハンドラに差し替える：

```tsx
<button aria-label="前の写真" onClick={handlePrev} ...>‹</button>
<button aria-label="次の写真" onClick={handleNext} ...>›</button>
```

- [ ] **Step 4: テストを実行して通過を確認する**

```
npx vitest run src/components/Slideshow.test.tsx
```

期待: 全テスト PASS

- [ ] **Step 5: TypeScript 型チェックを確認する**

```
npx tsc --noEmit
```

期待: エラーなし

- [ ] **Step 6: コミットする**

```bash
git add src/components/Slideshow.tsx src/components/Slideshow.test.tsx
git commit -m "feat: 全画面ナビゲーション（前/次）とタイマーリセットを実装"
```
