# スライドショー全画面表示 — Design Spec

**Date**: 2026-05-08

## Overview

ホスト向けのスライドショーに全画面表示機能を追加する。Fullscreen API を使い、スライドショー右下の ⛶ ボタンで全画面に移行。全画面中は左右ナビゲーションと閉じるボタンを表示する。

---

## Requirements

| 項目 | 内容 |
|------|------|
| 対象ユーザー | ホストのみ（スライドショー自体がホスト限定） |
| 全画面起動 | スライドショー右下の ⛶ ボタン |
| 全画面終了 | 全画面内の ✕ ボタン、または ESC キー |
| ナビゲーション | 全画面中に前 ‹ / 次 › ボタンで手動スキップ |
| オートスライド | 全画面中も5秒ごと継続。手動スキップでタイマーリセット |
| ボタン表示制御 | `document.fullscreenEnabled` が `false` の場合 ⛶ ボタン非表示 |
| 実装方式 | Fullscreen API（`requestFullscreen` / `exitFullscreen`） |

---

## UI

### 通常表示

```
┌──────────────────────────────────────────┐
│                                          │
│              🌄 写真                      │
│                                          │
│                              2 / 5  [⛶] │
└──────────────────────────────────────────┘
```

- カウンターの左隣に ⛶ ボタン（26×26px、半透明黒背景）

### 全画面表示

```
┌──────────────────────────────┐
│ 2 / 5                    [✕] │
│                              │
│ [‹]      🌄 写真        [›] │
│                              │
│     自動スライド継続中        │
└──────────────────────────────┘
```

- 黒背景、写真は `object-contain` でフィット
- 左上: カウンター（半透明黒バッジ）
- 右上: ✕ ボタン
- 左右中央: ‹ › ナビゲーションボタン（36×36px）
- 下部: 「自動スライド継続中」テキスト（薄い白）

---

## Architecture

**変更ファイル**: `src/components/Slideshow.tsx` のみ

### 追加 state / ref

| 名前 | 型 | 用途 |
|------|-----|------|
| `containerRef` | `RefObject<HTMLDivElement>` | `requestFullscreen()` の対象要素 |
| `isFullscreen` | `boolean` | 全画面中かどうか（UI切り替え） |
| `fullscreenEnabled` | `boolean` | ⛶ ボタン表示制御（`useState(() => document.fullscreenEnabled ?? false)` で初期化） |
| `manualNavCount` | `number` | 手動スキップ時にタイマーリセットするトリガー |

### 追加ハンドラ

```ts
handleFullscreen()     // containerRef.current?.requestFullscreen()
handleExitFullscreen() // document.exitFullscreen()
handlePrev()           // currentIndex を -1、manualNavCount をインクリメント
handleNext()           // currentIndex を +1、manualNavCount をインクリメント
```

### タイマーリセット

既存の `useEffect`（setInterval）の依存配列に `manualNavCount` を追加。スキップのたびに interval が再生成され5秒カウントがリセットされる。

```ts
useEffect(() => {
  if (photos.length === 0) return
  const timer = setInterval(() => {
    setCurrentIndex((prev) => (prev + 1) % photos.length)
  }, 5000)
  return () => clearInterval(timer)
}, [photos.length, manualNavCount])
```

### fullscreenchange 同期

```ts
useEffect(() => {
  const handler = () => setIsFullscreen(!!document.fullscreenElement)
  document.addEventListener('fullscreenchange', handler)
  return () => document.removeEventListener('fullscreenchange', handler)
}, [])
```

ESC キー終了も自動検知。

---

## Error Handling

- `requestFullscreen()` は Promise を返す。reject 時は `console.error` のみ（silent fail）
- `fullscreenEnabled` が false の場合はボタン非表示で起動不可能な状態にしない

---

## Testing

- `isFullscreen` state が `fullscreenchange` イベントで正しく更新されるか
- `manualNavCount` インクリメントでタイマーがリセットされるか（`photos.length` 依存の既存テストを拡張）
- `fullscreenEnabled = false` のとき ⛶ ボタンが非表示になるか

---

## Out of Scope

- ゲストへのスライドショー開放
- スワイプジェスチャーでのナビゲーション
- iOS Safari 対応（Fullscreen API 非対応のため）
- 全画面中の写真ダウンロード
