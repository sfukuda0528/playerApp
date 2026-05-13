# Supabase セットアップ手順

**プロジェクト**: CampCanvas  
**対象**: 新規開発環境・本番環境の初期セットアップ

---

## 前提条件

- Node.js 18以上
- npm インストール済み
- Supabase アカウント作成済み（[supabase.com](https://supabase.com)）

---

## 1. Supabase プロジェクト作成

1. [Supabase Dashboard](https://supabase.com/dashboard) にアクセス
2. **New project** をクリック
3. 設定:
   - **Name**: `campcanvas`（任意）
   - **Database Password**: 強力なパスワードを設定（控えておく）
   - **Region**: `Northeast Asia (Tokyo)` を推奨
4. **Create new project** → プロビジョニング完了まで待機（約30秒）

---

## 2. 環境変数の設定

Supabase Dashboard → **Project Settings** → **API** から以下を取得:

| 変数 | 取得場所 |
|------|---------|
| `VITE_SUPABASE_URL` | Project URL |
| `VITE_SUPABASE_ANON_KEY` | `anon` `public` キー |

プロジェクトルートに `.env.local` を作成:

```bash
VITE_SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

> `.env.local` は `.gitignore` に含める（機密情報のため）

---

## 3. 匿名認証の有効化

Dashboard → **Authentication** → **Providers** → **Anonymous Sign Ins**

- **Enable anonymous sign-ins** をオン

CampCanvas は UI 上で名前入力のみだが、内部で Anonymous Sign-In を使用して `auth.uid()` を発行し RLS を適用する。

---

## 4. データベースマイグレーション適用

### 方法A: Supabase CLI（推奨）

```bash
# CLIインストール（未インストールの場合）
npm install -D supabase

# ログイン
npx supabase login

# プロジェクトにリンク（Project ID は Dashboard の Settings > General で確認）
npx supabase link --project-ref <project-id>

# マイグレーション適用（全ファイルを順に適用）
npx supabase db push
```

### 方法B: SQL Editor（CLIなしで手軽に）

1. Dashboard → **SQL Editor** → **New query**
2. 以下のマイグレーションファイルを **順番通りに** 貼り付けて **Run**:

| 順序 | ファイル | 内容 |
|------|---------|------|
| 1 | `supabase/migrations/20260424000000_sessions.sql` | sessions / participants テーブル・RLS・Realtime |
| 2 | `supabase/migrations/20260426000001_sessions_replica_identity.sql` | sessions の REPLICA IDENTITY FULL |
| 3 | `supabase/migrations/20260426000002_media_sharing.sql` | photos / music_links テーブル・RLS・sessions.host_auth_id 追加 |
| 4 | `supabase/migrations/20260426000003_storage_setup.sql` | Storage バケット `photos` 作成・RLS |
| 5 | `supabase/migrations/20260427000001_fix_rls_recursion.sql` | RLS 再帰参照の修正 |
| 6 | `supabase/migrations/20260503000001_music_links_replica_identity.sql` | music_links の REPLICA IDENTITY FULL |
| 7 | `supabase/migrations/20260509000001_add_title_sort_order.sql` | music_links の title / sort_order 追加 |
| 8 | `supabase/migrations/20260511000001_fix_participant_insert_vulnerability.sql` | participants 直接 INSERT 封鎖・join_session RPC 追加 |
| 9 | `supabase/migrations/20260511000002_create_session_rpc.sql` | create_session RPC 追加 |
| 10 | `supabase/migrations/20260511000003_music_links_update_policy.sql` | music_links 並び替え更新ポリシー追加 |
| 11 | `supabase/migrations/20260511000004_ensure_session_rpcs.sql` | session RPC 再保証・実行権限付与 |
| 12 | `supabase/migrations/20260511000005_kick_participant_rpc.sql` | ホストによる参加者キック RPC 追加 |
| 13 | `supabase/migrations/20260511000006_leave_session_rpc.sql` | 参加者退出 RPC 追加 |
| 14 | `supabase/migrations/20260512000001_prevent_duplicate_session_participants.sql` | 同一ユーザーの重複参加防止 |
| 15 | `supabase/migrations/20260512000002_participants_photos_replica_identity.sql` | participants / photos の REPLICA IDENTITY FULL |
| 16 | `supabase/migrations/20260513000001_add_session_started_at.sql` | sessions.started_at 追加 |
| 17 | `supabase/migrations/20260513000002_music_playback_state.sql` | music_playback_state テーブル追加 |
| 18 | `supabase/migrations/20260513000003_start_session_rpc.sql` | start_session RPC 追加 |
| 19 | `supabase/migrations/20260513000004_music_links_host_delete_policy.sql` | ホストの music_links 削除ポリシー追加 |
| 20 | `supabase/migrations/20260513000005_raise_session_capacity_to_five.sql` | セッション上限人数を5人に変更 |

> **全ファイルの適用が必要**。現在のフロントエンドは `create_session` / `join_session` RPC に依存するため、2026-05-11 以降のマイグレーションも本番に適用する。

---

## 5. Realtime 設定確認

マイグレーションで自動設定されるが、念のため確認:

Dashboard → **Database** → **Replication** → `supabase_realtime` パブリケーション

以下のテーブルが含まれていることを確認:
- `public.participants`
- `public.sessions`

含まれていない場合は SQL Editor で実行:

```sql
alter publication supabase_realtime add table public.participants;
alter publication supabase_realtime add table public.sessions;
```

---

## 6. Edge Function デプロイ（非アクティブセッション自動終了）

### デプロイ

```bash
# Edge Function をデプロイ
npx supabase functions deploy session-cleanup
```

### スケジュール設定（5分ごと実行）

Dashboard → **Edge Functions** → `session-cleanup` → **Schedules** タブ

**New schedule** をクリック:

```
Name: session-cleanup-cron
Cron expression: */5 * * * *
```

> Supabase Scheduled Functions の最小実行間隔は1分。5分ごとの設定で非アクティブ検知の精度は±5分。

### ローカルでのテスト（任意）

```bash
npx supabase functions serve session-cleanup
# 別ターミナルで:
curl -i http://localhost:54321/functions/v1/session-cleanup
# 期待: {"checked":N,"ended":M}
```

---

## 7. Storage バケット設定

`supabase/migrations/20260426000003_storage_setup.sql` で自動作成される（手順4で適用済みなら不要）。

手動で確認する場合:

Dashboard → **Storage** → `photos` バケットが存在することを確認。存在しない場合は SQL Editor で `20260426000003_storage_setup.sql` を実行。

バケット仕様:
- 名前: `photos`
- 公開: **非公開**（RLSで同一セッション参加者のみ閲覧可）
- ファイルサイズ上限: 5 MB
- 許可 MIME タイプ: `image/jpeg`, `image/png`, `image/webp`, `image/gif`, `image/heic`

---

## 8. 動作確認

```bash
npm run dev
```

ブラウザで `http://localhost:5173` にアクセスし:

1. **セッション開始** → 名前入力 → QRコード + 6桁コードが表示される
2. 別タブで **セッションに参加** → コード入力 → 名前入力 → 参加完了
3. 招待画面の参加者数がリアルタイムで更新される
4. メイン画面の **セッション終了** でトップへ遷移

---

## テーブル構成（参照）

### sessions

| カラム | 型 | 備考 |
|--------|-----|------|
| id | uuid | PK |
| code | char(6) | 参加コード（UNIQUE） |
| host_name | text | ホストのニックネーム |
| status | text | `active` \| `ended` |
| last_active_at | timestamptz | 最終アクティビティ時刻 |
| inactivity_timeout_min | int | デフォルト360（6時間） |
| created_at | timestamptz | |

### participants

| カラム | 型 | 備考 |
|--------|-----|------|
| id | uuid | PK |
| session_id | uuid | FK → sessions.id |
| name | text | ニックネーム |
| auth_id | uuid | Supabase Anonymous auth.uid() |
| joined_at | timestamptz | |

---

## トラブルシューティング

| 症状 | 原因・対処 |
|------|-----------|
| `Missing Supabase env vars` エラー | `.env.local` の値が未設定 → Dashboard の API タブで再確認 |
| RLS エラー（403） | Anonymous Sign-In が無効 → Dashboard の Authentication で有効化 |
| セッション作成で `create_session` が見つからない | 最新マイグレーション未適用 → 手順4のマイグレーションを全順で再実行 |
| Realtime が届かない | テーブルがパブリケーションに追加されていない → 手順5を再実行 |
| 写真アップロードが失敗する | Storage バケット `photos` が未作成 → 手順7（`20260426000003_storage_setup.sql` 適用）を実行 |
| 音楽追加・写真追加が失敗する | `20260426000002_media_sharing.sql` 未適用 → 手順4のマイグレーションを全順で再実行 |
| Edge Function 500 エラー | `SUPABASE_SERVICE_ROLE_KEY` が未設定 → Dashboard の Secrets で確認 |
| コード入力で「セッションが見つかりません」 | セッションが `ended` になっている or コードが間違い |
