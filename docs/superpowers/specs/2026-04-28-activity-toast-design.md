# 設計書：写真・音楽追加者通知トースト

## 概要

写真または音楽が追加されたとき、追加者名をリアルタイムトーストでヘッダー直下に3秒表示する。

## 要件

- 対象イベント：写真追加、音楽追加
- 表示タイミング：INSERT イベント検知と同時（全参加者分、自分含む）
- 表示位置：ヘッダー直下
- 表示時間：3秒後に自動消去
- 複数連続追加：新しいトーストが前のタイマーを上書き

## アーキテクチャ

変更ファイル：

| ファイル | 変更内容 |
|---|---|
| `src/hooks/usePhotos.ts` | `onInsert` コールバックオプション追加 |
| `src/components/MainPage.tsx` | トースト state・コールバック・UI 追加 |

## データフロー

```
Supabase INSERT イベント
  → usePhotos / useMusicLinks の onInsert コールバック発火
  → MainPage で auth_id → 名前解決（participants で検索、未発見時は "メンバー"）
  → toast state にセット（id でエフェクトリセット）
  → 3秒後に自動クリア
```

## トーストメッセージ形式

- 写真：`📷 {name}さんが写真を追加しました`
- 音楽：`🎵 {name}さんが音楽を追加しました`

## Toast State

```ts
type Toast = { message: string; id: number } | null
```

`id` は単調増加カウンター（useRef）。useEffect の依存配列に `toast?.id` を使うことで、連続追加時にタイマーをリセットする。

## UI 仕様

```
[ヘッダー: 🏕 CampCanvas    👥 2/4]
┌─────────────────────────────────┐
│ 📷 田中さんが写真を追加しました  │
└─────────────────────────────────┘
[タブコンテンツ]
```

- 背景：`bg-camp-brown/90`
- 文字：`text-camp-cream text-sm text-center`
- パディング：`px-4 py-2`
- アニメーション：なし（条件レンダリング）

## usePhotos 変更詳細

`useMusicLinks` が持つ `onInsert` パターンをそのまま踏襲：

```ts
export function usePhotos(
  sessionId: string,
  options?: { onInsert?: (photo: Photo) => void }
)
// INSERT ハンドラー内：
// onInsertRef.current?.(newPhoto)
```

## MainPage 変更詳細

```ts
const [toast, setToast] = useState<{ message: string; id: number } | null>(null)
const toastIdRef = useRef(0)

const resolveName = (authId: string) =>
  participants.find((p) => p.auth_id === authId)?.name ?? 'メンバー'

const showToast = (message: string) => {
  const id = ++toastIdRef.current
  setToast({ message, id })
}

useEffect(() => {
  if (!toast) return
  const t = setTimeout(() => setToast(null), 3000)
  return () => clearTimeout(t)
}, [toast?.id])
```

JSX（ヘッダー直下）：

```tsx
{toast && (
  <div className="bg-camp-brown/90 text-camp-cream text-sm px-4 py-2 text-center">
    {toast.message}
  </div>
)}
```
