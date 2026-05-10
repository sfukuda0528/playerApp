# プレイリストURL展開機能 設計書

**日付**: 2026-05-10  
**対象ブランチ**: working

## 概要

URLタブでプレイリストURLを入力した場合、プレイリスト内の動画を個別の `music_links` レコードとして1件ずつキューに追加する。

## 前提・制約

- 対象URLは `youtube.com/playlist?list=xxx` 形式のみ
- `watch?v=xxx&list=yyy`（動画URL+プレイリストパラメータ）は既存の1曲フローで処理（プレイリスト無視）
- 取得件数は最大50件（YouTube API 1ページ目のみ）
- YouTube Data API v3 キー（`VITE_YOUTUBE_API_KEY`）は既存の検索機能で利用中

## アーキテクチャ

### 新規ファイル

**`src/hooks/usePlaylistItems.ts`**  
YouTube Playlist Items API を叩いてビデオ一覧を返す専用フック。責務はAPIフェッチのみ。

### 変更ファイル

| ファイル | 変更内容 |
|----------|----------|
| `src/hooks/useAddMusicLink.ts` | `addLinks`（複数件バッチinsert）を追加 |
| `src/components/MusicPanel.tsx` | プレイリスト検知・進捗表示・新フック呼び出しを組み込む |
| `src/utils/youtube.ts` | 変更なし（既存の `extractYouTubeId` / `extractPlaylistId` をそのまま利用） |

## データフロー

### 検知ロジック（`MusicPanel.handleAddFromUrl`）

```
videoId = extractYouTubeId(urlInput)
playlistId = extractPlaylistId(urlInput)

if (playlistId && !videoId) → プレイリストフロー
else                         → 既存の1曲フロー（変更なし）
```

### `usePlaylistItems` フック

```ts
fetchPlaylistItems(playlistId: string): Promise<{ videoId: string; title: string }[] | null>
```

- エンドポイント: `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&maxResults=50&playlistId={id}&key={apiKey}`
- 成功時: `{ videoId: snippet.resourceId.videoId, title: snippet.title }[]`
- 失敗時: `null` を返し `error` state をセット

### `useAddMusicLink.addLinks`（新規）

```ts
addLinks(
  sessionId: string,
  items: { url: string; title: string }[],
  position: 'head' | 'tail',
  currentLink?: MusicLink,
  nextLink?: MusicLink
): Promise<boolean>
```

**sort_order 計算:**
- `tail`: `tailSort + 1000 * i`（i = 0..N-1）
- `head`: `currentSort + step * (i + 1)`（i = 0..N-1）
  - nextLink あり: `step = (nextSort - currentSort) / (N + 1)`
  - nextLink なし: `step = 1000`

Supabase に `insert([...])` で1回のAPIコール。

### 進捗表示（`MusicPanel` state）

```ts
playlistProgress: { phase: 'fetching' | 'inserting'; total: number } | null
```

| phase | 表示文言 |
|-------|---------|
| `fetching` | 「プレイリスト取得中...」 |
| `inserting` | 「{total}件をキューに追加中...」 |
| `null` | 非表示 |

## エラー処理

| ケース | 処理 |
|--------|------|
| プレイリストが0件 | 「プレイリストに動画がありません」エラー表示 |
| YouTube API失敗 | `usePlaylistItems` の `error` state → `MusicPanel` 既存エラー領域に表示 |
| Supabase バッチinsert失敗 | `useAddMusicLink` の `error` state → 既存エラー領域に表示 |
| 追加中の別操作 | `loading` フラグで入力・ボタンをdisabled（既存挙動と同じ） |

## 対象外（スコープ外）

- プレイリストの複数ページ取得（51件以上）
- プレイリスト内動画の選択追加
- 追加後の途中キャンセル
