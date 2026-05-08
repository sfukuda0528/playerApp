# YouTube検索・キュー強化 設計書

## 概要

MusicPanelにYouTube検索機能を追加し、キューの先頭/末尾への追加とドラッグ&ドロップ並び替えを実装する。キューのラベルをURLからタイトルに変更する。

## DBスキーマ変更

`music_links` テーブルに2カラム追加:

```sql
ALTER TABLE public.music_links
  ADD COLUMN title text NOT NULL DEFAULT '',
  ADD COLUMN sort_order float NOT NULL DEFAULT 0;
```

- 既存レコードの `sort_order` は `EXTRACT(EPOCH FROM created_at)` で初期化（既存順序を保持）
- 取得クエリを `order('sort_order', ascending: true)` に変更

### 追加時の `sort_order` 算出ルール

| 操作 | sort_order |
|------|-----------|
| 末尾追加 | `MAX(sort_order) + 1000`（レコード0件時は `0`） |
| 先頭追加 | `MIN(sort_order) - 1000`（レコード0件時は `0`） |
| ドラッグ中間移動 | `(前のアイテム.sort_order + 次のアイテム.sort_order) / 2` |
| 先頭へ移動 | `MIN(sort_order) - 1000` |
| 末尾へ移動 | `MAX(sort_order) + 1000` |

## 型定義変更

`MusicLink` に `title` と `sort_order` を追加:

```ts
export interface MusicLink {
  id: string
  session_id: string
  added_by_auth_id: string
  url: string
  title: string       // 追加
  sort_order: number  // 追加
  created_at: string
}
```

## 新規フック

### `useYouTubeSearch`

YouTube Data API v3 `/search` を呼び出す。

```ts
interface VideoItem {
  videoId: string
  title: string
  thumbnail: string  // mqdefault thumbnail URL
}

function useYouTubeSearch(): {
  results: VideoItem[]
  loading: boolean
  error: string | null
  search: (query: string) => Promise<void>
  clear: () => void
}
```

- `VITE_YOUTUBE_API_KEY` 環境変数を使用
- 検索はEnterキーまたは検索ボタンでトリガー（デバウンスなし）
- パラメータ: `type=video`, `maxResults=10`, `part=snippet`

### `useYouTubeVideoTitle`

URL入力タブ用。oEmbed APIでタイトル取得（APIキー不要）。

```ts
function useYouTubeVideoTitle(): {
  title: string | null
  loading: boolean
  fetchTitle: (url: string) => Promise<void>
  clear: () => void
}
```

- エンドポイント: `https://www.youtube.com/oembed?url=<url>&format=json`
- URL入力のonBlurまたは入力確定時にトリガー

## `useAddMusicLink` 変更

`addLink` シグネチャに `title` と `position` を追加:

```ts
addLink(
  sessionId: string,
  url: string,
  title: string,
  position: 'head' | 'tail'
): Promise<boolean>
```

内部で `sort_order` を算出してからinsert。  
算出のために `SELECT MIN/MAX(sort_order)` を先行実行する。

## `useReorderMusicLink` 新規フック

ドラッグ&ドロップ確定時に `sort_order` を更新する。

```ts
function useReorderMusicLink(): {
  reorder: (linkId: string, newSortOrder: number) => Promise<boolean>
}
```

## MusicPanel UI変更

### タブ構成

既存の `@radix-ui/react-tabs` を使用。デフォルトタブ: `search`。

```
[検索] [URL入力]
```

### 検索タブ

```
[検索ワード入力________] [🔍]

─ 検索結果 ─────────────────
[🖼 48px] 動画タイトル A        [先頭] [末尾]
[🖼 48px] 動画タイトル B        [先頭] [末尾]
...（最大10件）
```

- サムネイル: `mqdefault` (320×180) を 48px で表示
- 追加ボタン押下後、結果リストはそのまま維持（連続追加を許容）

### URL入力タブ

```
[URL入力__________________]
タイトル: （自動取得中... or タイトル文字列）
[先頭に追加] [末尾に追加]
```

- URL入力欄のonBlurでタイトル自動取得
- タイトル取得失敗時はURL文字列をtitleとしてフォールバック

### キュー表示変更

- `link.url` → `link.title` に変更
- 各アイテム左端にドラッグハンドル `⠿` を追加
- `@dnd-kit/sortable` でドラッグ&ドロップ実装

## 依存パッケージ追加

```
@dnd-kit/core
@dnd-kit/sortable
@dnd-kit/utilities
```

## ファイル変更一覧

| ファイル | 変更種別 |
|---------|---------|
| `supabase/migrations/20260509000001_add_title_sort_order.sql` | 新規 |
| `src/types/session.ts` | `MusicLink` に `title`, `sort_order` 追加 |
| `src/hooks/useAddMusicLink.ts` | `addLink` シグネチャ変更、sort_order算出追加 |
| `src/hooks/useMusicLinks.ts` | orderを `sort_order` 昇順に変更 |
| `src/hooks/useYouTubeSearch.ts` | 新規 |
| `src/hooks/useYouTubeVideoTitle.ts` | 新規 |
| `src/hooks/useReorderMusicLink.ts` | 新規 |
| `src/components/MusicPanel.tsx` | タブUI、検索UI、ドラッグ並び替え追加 |
| `src/components/MusicPanel.test.tsx` | テスト更新 |
