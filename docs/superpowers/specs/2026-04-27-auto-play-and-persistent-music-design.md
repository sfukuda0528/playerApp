# 自動再生 & タブ跨ぎ音楽継続 設計書

## 概要

2つの機能を同時実装する。

1. **自動再生**: 誰かが YouTube リンクを追加したら自動で再生を開始
2. **音楽継続**: 写真スライドショータブに切り替えても音楽が再生され続ける

---

## 要件

### 自動再生

- 誰が追加しても（自分 / 他参加者のリアルタイム）トリガーする
- 未再生の場合: 即座に再生開始
- 再生中の場合: キューに追加するだけ（現在の曲が終了後に自動進行する既存動作を維持）
- 初期ロード時のリンク一覧では自動再生しない

### 音楽継続

- 写真タブ・メンバータブに切り替えても YouTube 再生を止めない
- タブを音楽に戻したとき、プレイヤーが表示されていること

---

## アーキテクチャ

### 変更ファイル

| ファイル | 変更内容 |
|---|---|
| `src/hooks/useMusicLinks.ts` | `onInsert` コールバック追加 |
| `src/components/MusicPanel.tsx` | `onInsert` を渡す |
| `src/components/MainPage.tsx` | `forceMount` 追加 |

---

## 詳細設計

### `useMusicLinks.ts`

第2引数にオプションオブジェクトを追加する。

```ts
export function useMusicLinks(
  sessionId: string,
  options?: { onInsert?: (link: MusicLink) => void }
)
```

**stale クロージャ対策**: `onInsert` を `useRef` で管理し、毎レンダーで最新化する。Supabase チャンネルは `sessionId` が変わるときのみ再生成。

```ts
const onInsertRef = useRef(options?.onInsert)
useEffect(() => { onInsertRef.current = options?.onInsert })

// INSERT ハンドラ内
(payload) => {
  const newLink = payload.new as MusicLink
  setLinks((prev) => [...prev, newLink])
  onInsertRef.current?.(newLink)
}
```

初期ロード（`.then()` ブロック）では `onInsertRef` を呼ばない。

### `MusicPanel.tsx`

functional setState で `isPlaying` の ref 管理が不要。

```ts
const { links } = useMusicLinks(sessionId, {
  onInsert: () => setIsPlaying((prev) => prev || true),
})
```

- `prev = true`（再生中）→ `true` のまま（変化なし）
- `prev = false`（未再生）→ `true`（自動再生開始）

### `MainPage.tsx`

```tsx
<TabsContent value="music" forceMount className="flex-1 overflow-y-auto mt-0">
```

`forceMount` により非アクティブ時も DOM に保持される。Radix UI が `hidden` 属性（= `display: none`）を付与して視覚的に非表示にするが、YouTube iframe はアンマウントされないため音声が継続する。

---

## エラーハンドリング

- 既存の `onError` フォールバック（`playerError` state）は変更なし
- `onInsert` コールバック内でエラーは起きない（state 更新のみ）

---

## テスト方針

### `useMusicLinks.test.ts`

- INSERT イベントで `onInsert` が呼ばれること
- 初期ロード（fetch）では `onInsert` が呼ばれないこと
- DELETE イベントでは `onInsert` が呼ばれないこと

### `MusicPanel.test.tsx`

- 新リンク到着（INSERT）で `isPlaying` が `true` になること
- 再生中（`isPlaying = true`）に新リンクが到着しても `isPlaying` が変化しないこと
