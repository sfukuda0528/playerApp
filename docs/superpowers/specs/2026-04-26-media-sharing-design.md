# CampCanvas メディア共有機能 設計書

Date: 2026-04-26

## 概要

CampCanvas のメインセッション画面（`/session/:sessionId`）に、写真アップロード・スライドショー・音楽リンク共有機能を追加する。

### 要件まとめ
- 写真: 全参加者がアップロード可、自分のものは削除可
- スライドショー: 自動進行（5秒間隔）、ホスト画面のみ表示
- 音楽: YouTube/Spotify URL を共有するだけ（再生は各自）
- ストレージ: Supabase Storage

---

## データモデル

### sessions テーブル変更

```sql
ALTER TABLE public.sessions ADD COLUMN host_auth_id uuid;
```

セッション作成時に `auth.uid()` をセット。ホスト判定に使用。

### photos テーブル（新規）

```sql
CREATE TABLE public.photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  uploader_auth_id uuid NOT NULL,
  storage_path text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
```

RLS:
- SELECT: 同一セッション参加者のみ
- INSERT: `uploader_auth_id = auth.uid()` かつ参加者のみ
- DELETE: `uploader_auth_id = auth.uid()`

Realtime: 有効化

### music_links テーブル（新規）

```sql
CREATE TABLE public.music_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  added_by_auth_id uuid NOT NULL,
  url text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
```

RLS: photos と同一方針

Realtime: 有効化

### Supabase Storage

バケット名: `photos`  
アクセス: 認証済みユーザーのみアップロード可  
パス規則: `{sessionId}/{timestamp}_{filename}`

---

## フック

### usePhotos(sessionId)

- photos テーブルから初期取得
- Realtime で INSERT/DELETE を購読し配列を同期
- 戻り値: `{ photos, loading, error }`

### useUploadPhoto()

- Storage へファイルアップロード
- 成功後 photos テーブルに INSERT
- 戻り値: `{ upload, loading, error }`

### useMusicLinks(sessionId)

- music_links テーブルから初期取得
- Realtime で INSERT/DELETE を購読
- 戻り値: `{ links, loading, error }`

### useAddMusicLink()

- URL バリデーション（YouTube/Spotify のみ許可）
- music_links テーブルに INSERT
- 戻り値: `{ addLink, loading, error }`

URL 許可パターン:
```
youtube.com/watch
youtu.be/
open.spotify.com/
```

---

## コンポーネント

### 型定義追加（src/types/session.ts）

```ts
export interface Photo {
  id: string
  session_id: string
  uploader_auth_id: string
  storage_path: string
  created_at: string
}

export interface MusicLink {
  id: string
  session_id: string
  added_by_auth_id: string
  url: string
  created_at: string
}
```

### Slideshow

Props: `photos: Photo[]`

- `currentIndex` state で表示する写真を管理
- `setInterval(5000)` で自動進行（photos.length > 0 のときのみ動作）
- 新規写真は配列末尾に追加（現在表示中のインデックスは変更しない）
- 空時: 「写真がまだありません」プレースホルダー

### PhotoUpload

Props: `sessionId: string`

- `<input type="file" accept="image/*">` で1ファイル選択
- `useUploadPhoto` 呼び出し
- アップロード中は disabled
- エラーは inline 表示

### MusicPanel

Props: `sessionId: string`, `currentUserId: string`

- URL 入力フォーム（`useAddMusicLink` 呼び出し）
- 追加済みリンク一覧（リンクテキストのみ、埋め込みなし）
- 自分が追加したリンクに削除ボタン表示
- Realtime で他参加者の追加/削除を即時反映

---

## MainPage 変更

### ホスト判定

```ts
const { data: { user } } = await supabase.auth.getUser()
const isHost = session?.host_auth_id === user?.id
```

### ホスト view

```
<Slideshow photos={photos} />
<MusicPanel sessionId={sessionId} />
<PhotoUpload sessionId={sessionId} />
<button>セッション終了</button>
<button>＋メンバー</button>
```

### 参加者 view

```
<PhotoUpload sessionId={sessionId} />
<MusicPanel sessionId={sessionId} />
```

---

## useSessionCreate 変更

sessions INSERT 時に `host_auth_id: user.id` を追加。

---

## テスト方針

TDD。各フック・コンポーネントに対応する `.test.ts(x)` を同ディレクトリに配置。

- `usePhotos`: Realtime INSERT/DELETE で配列が更新されること
- `useUploadPhoto`: Storage upload + photos INSERT の呼び出し順
- `useMusicLinks`: Realtime 購読、バリデーション失敗ケース
- `useAddMusicLink`: 不正URL（Twitter等）は INSERT しないこと
- `Slideshow`: 空配列でプレースホルダー表示、タイマー自動進行
- `PhotoUpload`: アップロード中 disabled、エラー表示
- `MusicPanel`: 自分のリンクのみ削除ボタン表示
