# YouTube BGM Player 設計書

**日付**: 2026-04-27
**対象ブランチ**: 1-claude-setup

## 概要

MusicPanel のURL表示をYouTube BGM再生に置き換える。Spotifyサポートを削除してYouTube専用とし、MusicPanel内にキュー再生プレイヤーを埋め込む。

## 要件

- YouTubeリンク追加時にページ内でBGMとして再生
- プレイヤーはMusicPanel内に埋め込み（フローティングバーなし）
- 再生コントロール: 再生/停止 + 次へ/前へ
- キュー再生: 追加順に自動で次の曲へ、末尾から先頭に戻る
- Spotifyサポート削除、YouTube専用

## アーキテクチャ

### 追加依存

```
react-youtube  — YouTube IFrame API の React ラッパー
```

### 変更ファイル

| ファイル | 変更内容 |
|---|---|
| `src/hooks/useAddMusicLink.ts` | Spotify バリデーション削除、YouTube専用に |
| `src/components/MusicPanel.tsx` | キュー state + プレイヤー UI 追加 |
| `src/components/MusicPanel.test.tsx` | テスト更新 |
| `src/hooks/useAddMusicLink.test.ts` | Spotify テストケース削除 |

### 新規ファイル

| ファイル | 役割 |
|---|---|
| `src/components/YouTubePlayer.tsx` | react-youtube ラッパー、再生/停止・次へ/前へ UI |
| `src/components/YouTubePlayer.test.tsx` | プレイヤー単体テスト |
| `src/utils/youtube.ts` | URL → 動画ID 抽出ユーティリティ |
| `src/utils/youtube.test.ts` | ID抽出のユニットテスト |

### データフロー

```
useMusicLinks → links[]
      ↓
MusicPanel  (currentIndex: number, isPlaying: boolean を保持)
  ├── links[currentIndex].url → extractYouTubeId() → videoId
  ├── YouTubePlayer (videoId, isPlaying, onEnded → currentIndex++)
  └── リスト表示 (currentIndex 行をハイライト)
```

## コンポーネント詳細

### YouTubePlayer

```tsx
interface Props {
  videoId: string
  isPlaying: boolean
  onEnded: () => void
  onPrev: () => void
  onNext: () => void
  hasPrev: boolean
  hasNext: boolean
}
```

- react-youtube の `<YouTube>` をラップ
- `isPlaying` 変化時に `playerRef.current.playVideo()` / `pauseVideo()` を呼ぶ
- プレイヤー本体は小さく表示（YouTube利用規約で完全非表示は禁止）
- `onEnded` → 親が `currentIndex + 1`（末尾なら 0 に戻る）

### MusicPanel state 追加

```ts
const [currentIndex, setCurrentIndex] = useState(0)
const [isPlaying, setIsPlaying] = useState(false)
```

- `links` 変化時に `currentIndex` が範囲外ならクランプ
- 再生中ハイライト: リスト内の該当行に背景色変更
- 削除ハンドリング: 削除対象が再生中 → `isPlaying = false`, `currentIndex = 0`

### youtube.ts ユーティリティ

```ts
export function extractYouTubeId(url: string): string | null
// "https://www.youtube.com/watch?v=XXXXX" → "XXXXX"
// "https://youtu.be/XXXXX" → "XXXXX"
// 無効URL → null
```

### useAddMusicLink バリデーション変更

```ts
// 変更後
const ALLOWED = [
  /^https?:\/\/(www\.)?youtube\.com\/watch/,
  /^https?:\/\/youtu\.be\//,
]
// エラーメッセージ: "YouTube の URL を入力してください"
```

## エラー処理

| ケース | 対応 |
|---|---|
| `links` が空 | プレイヤー非表示、入力フォームのみ表示 |
| 無効URL | `addLink` のバリデーションで事前に弾く |
| YouTube API 読み込み失敗 | `onError` で「再生できません」表示 |
| 再生中リンクが削除 | `isPlaying = false`、`currentIndex = 0` にリセット |

## テスト方針

- `youtube.test.ts` — `extractYouTubeId` の入力パターン網羅（watch URL、短縮URL、無効URL）
- `YouTubePlayer.test.tsx` — react-youtube を `vi.mock` でモック、再生/停止/次へ/前へのUI操作テスト
- `MusicPanel.test.tsx` — links空時の非表示、再生中ハイライト、削除時リセットのテスト
- `useAddMusicLink.test.ts` — Spotifyテストを削除、YouTube専用バリデーションのみ
