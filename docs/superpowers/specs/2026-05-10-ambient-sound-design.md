# 環境音自動再生 設計書

## 概要

キューが空かつ音楽未再生のとき、ホストのブラウザでYouTubeの環境音（昼：森/自然音、夜：キャンプファイヤー音）を自動ループ再生する機能。

## 要件

- ホストのみ再生（非ホストには影響なし）
- キューが空のとき自動で環境音を再生開始
- キューに曲が追加されると自動で通常プレイヤーに切り替わる
- 停止・選択UIなし（完全自動）
- 昼（6:00〜17:59）: YouTube動画 `b7dAF4WYSyA`
- 夜（18:00〜5:59）: YouTube動画 `kmythL1LppA`
- 無限ループ再生

## アーキテクチャ

### 新規ファイル

#### `src/utils/ambient.ts`

```ts
const AMBIENT_DAY_ID = 'b7dAF4WYSyA'
const AMBIENT_NIGHT_ID = 'kmythL1LppA'

export function getAmbientVideoId(now: Date = new Date()): string {
  const hour = now.getHours()
  return hour >= 6 && hour < 18 ? AMBIENT_DAY_ID : AMBIENT_NIGHT_ID
}
```

- `now` を引数で受け取りテスタブルに設計

#### `src/components/AmbientPlayer.tsx`

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

- `loop: 1` + `playlist: videoId` でYouTube側がループ再生
- `controls: 0` でUI非表示
- エラーハンドリングなし（環境音なので静かに失敗でよい）

### 変更ファイル

#### `src/components/MusicPanel.tsx`

- `AmbientPlayer` と `getAmbientVideoId` をimport
- `isHost` ブロック内の表示条件を変更：

```tsx
// 変更前
{(videoId || playlistId) ? (
  <YouTubePlayer ... />
) : (
  <p>曲がキューにありません</p>
)}

// 変更後
{(videoId || playlistId) ? (
  <YouTubePlayer ... />
) : (
  <AmbientPlayer videoId={getAmbientVideoId()} />
)}
```

- state追加なし
- `links.length` の変化のみで切り替わる

## データフロー

```
links.length === 0 → AmbientPlayer（自動ループ・UIなし）
       ↓ 曲が追加される
links.length > 0  → YouTubePlayer（通常再生）
       ↓ 曲がすべて削除/再生終了
links.length === 0 → AmbientPlayer（再び自動ループ）
```

## エッジケース

| ケース | 挙動 |
|---|---|
| 環境音動画が再生エラー | 静かに失敗（スキップトーストなし） |
| 長時間再生で日またぎ | アンマウントされないので切り替えなし（許容） |
| 非ホストユーザー | `isHost` ブロック内のみのため影響なし |

## テスト

### `src/utils/ambient.test.ts`（新規）

- `getAmbientVideoId` のユニットテスト
  - 6:00 → 昼ID
  - 17:59 → 昼ID
  - 18:00 → 夜ID
  - 5:59 → 夜ID

### `src/components/MusicPanel.test.tsx`（追加）

- `isHost=true` + `links=[]` のとき `AmbientPlayer` がレンダリングされること
- `isHost=true` + `links=[...]` のとき `AmbientPlayer` がレンダリングされないこと
