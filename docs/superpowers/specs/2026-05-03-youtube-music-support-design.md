# YouTube Music リンク対応 設計書

## 概要

`music.youtube.com` URL（個別曲・プレイリスト）をキューに追加可能にする。
URL は保存前に `www.youtube.com` に正規化する（アプローチC）。
プレイリストはキューの1エントリとして追加し、YouTube iframe API が内部連続再生を担う。

---

## アーキテクチャ

### 変更ファイル

| ファイル | 変更内容 |
|---|---|
| `src/utils/youtube.ts` | `normalizeMusicUrl` / `extractPlaylistId` 追加 |
| `src/hooks/useAddMusicLink.ts` | 正規化・プレイリストバリデーション追加 |
| `src/components/YouTubePlayer.tsx` | `playlistId` prop 追加 |
| `src/components/MusicPanel.tsx` | プレイリスト判別・props 変更 |

---

## データフロー

```
ユーザー入力（例）
  https://music.youtube.com/playlist?list=PLxxx

  ↓ normalizeMusicUrl
  https://www.youtube.com/playlist?list=PLxxx

  ↓ isValidMusicUrl（パターン追加: youtube.com/playlist）
  → 合格

  ↓ Supabase INSERT（正規化済み URL を保存）

再生時:
  extractYouTubeId(url)  → null（v= なし）
  extractPlaylistId(url) → "PLxxx"
  YouTubePlayer に playlistId を渡す
  → playerVars.list="PLxxx", listType="playlist" で連続再生
```

個別曲フロー（変更なし）:
```
music.youtube.com/watch?v=XXX
  ↓ normalizeMusicUrl
  www.youtube.com/watch?v=XXX  ← 既存 ALLOWED パターンで通過
  ↓ extractYouTubeId → "XXX"
  YouTubePlayer に videoId を渡す（既存フロー）
```

---

## 各ファイルの変更詳細

### `src/utils/youtube.ts`

```typescript
// music.youtube.com → www.youtube.com に変換（それ以外は変更なし）
export function normalizeMusicUrl(url: string): string {
  return url.replace(/^(https?:\/\/)music\.youtube\.com/, '$1www.youtube.com')
}

// /playlist?list=... の list パラメータを抽出（v= がある場合は null）
export function extractPlaylistId(url: string): string | null {
  const match = url.match(/[?&]list=([^&]+)/)
  return match ? match[1] : null
}
```

`extractPlaylistId` は `extractYouTubeId` が null を返した場合にのみ呼び出すため、`watch?v=XXX&list=PLxxx` のような URL でプレイリストIDが誤抽出される問題は発生しない。

### `src/hooks/useAddMusicLink.ts`

```typescript
const ALLOWED: RegExp[] = [
  /^https?:\/\/(www\.)?youtube\.com\/watch/,
  /^https?:\/\/youtu\.be\//,
  /^https?:\/\/(www\.)?youtube\.com\/playlist/,  // 追加
]

const addLink = async (sessionId: string, url: string): Promise<boolean> => {
  const normalized = normalizeMusicUrl(url)  // 正規化
  if (!isValidMusicUrl(normalized)) {
    setError('YouTube または YouTube Music の URL を入力してください')
    return false
  }
  // DB には normalized を保存
  await supabase.from('music_links').insert({ ..., url: normalized })
}
```

### `src/components/YouTubePlayer.tsx`

Props に `playlistId?: string` を追加。

```typescript
interface Props {
  videoId?: string      // 個別曲
  playlistId?: string   // プレイリスト
  // ...既存 props
}
```

`opts` の組み立て:

```typescript
const playerVars = playlistId
  ? { autoplay: 0, list: playlistId, listType: 'playlist' }
  : { autoplay: 0 }

<YouTube
  videoId={videoId ?? ''}
  opts={{ width: '200', height: '113', playerVars }}
  // ...
/>
```

`useEffect` の依存配列に `playlistId` を追加してエラー状態をリセット。

### `src/components/MusicPanel.tsx`

```typescript
const currentLink = links[currentIndex]
const videoId = currentLink ? extractYouTubeId(currentLink.url) : null
const playlistId = !videoId && currentLink ? extractPlaylistId(currentLink.url) : null
const showPlayer = videoId !== null || playlistId !== null
```

YouTubePlayer に両 props を渡す:

```tsx
<YouTubePlayer
  videoId={videoId ?? undefined}
  playlistId={playlistId ?? undefined}
  // ...
/>
```

プレースホルダーを `"YouTube / YouTube Music URL"` に変更。

---

## エラーハンドリング

- バリデーション失敗時: `'YouTube または YouTube Music の URL を入力してください'`
- 再生失敗時: 既存の `'再生できません'` エラー表示をそのまま利用

---

## テスト方針

| ファイル | 追加テスト |
|---|---|
| `src/utils/youtube.test.ts` | `normalizeMusicUrl` / `extractPlaylistId` の各ケース |
| `src/hooks/useAddMusicLink.test.ts` | music.youtube.com URL の正規化・保存確認、プレイリスト URL の許可 |

既存テストへの影響なし（正規化は新規関数で分離）。

---

## 対応 URL パターン

| URL | 動作 |
|---|---|
| `music.youtube.com/watch?v=XXX` | 正規化 → 個別曲再生 |
| `music.youtube.com/playlist?list=PLxxx` | 正規化 → プレイリスト再生（YouTube 内部連続再生） |
| `youtube.com/watch?v=XXX` | 変更なし |
| `youtu.be/XXX` | 変更なし |
| `youtube.com/playlist?list=PLxxx` | 新規対応（プレイリスト再生） |
