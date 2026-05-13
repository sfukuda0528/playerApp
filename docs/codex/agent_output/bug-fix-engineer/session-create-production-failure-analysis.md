# 本番セッション作成失敗 原因分析

## 結論

最有力原因は、本番 Supabase DB に `supabase/migrations/20260511000002_create_session_rpc.sql` が未適用のまま、フロントエンドだけが `create_session` RPC 呼び出し版へ更新されたこと。

現在の `src/hooks/useSessionCreate.ts` は匿名ログイン後に `supabase.rpc('create_session', { p_host_name })` を呼ぶ。DB 側に `public.create_session(p_host_name text)` が存在しない場合、セッション作成だけが失敗する。

## 根拠

- `src/hooks/useSessionCreate.ts` は `sessions` / `participants` 直接 INSERT ではなく `create_session` RPC に依存。
- `supabase/migrations/20260511000001_fix_participant_insert_vulnerability.sql` は `participants` 直接 INSERT を `WITH CHECK (false)` で封鎖。
- `supabase/migrations/20260511000002_create_session_rpc.sql` が、封鎖後もセッション作成できるよう `SECURITY DEFINER` RPC を追加。
- `docs/supabase-setup.md` の SQL Editor 手順は 2026-04-26 までの migration しか列挙しておらず、2026-05-11 の RPC migration が案内されていない。

## 本番で出る可能性が高いエラー

- `Could not find the function public.create_session(p_host_name) in the schema cache`
- `function public.create_session(...) does not exist`
- 旧フロントエンドまたは中途半端な DB 状態なら `new row violates row-level security policy for table "participants"`

## 次点の原因

匿名認証が本番 Supabase で無効な場合も、`supabase.auth.signInAnonymously()` の時点で失敗する。この場合は RPC 以前に落ちるため、エラー文は Anonymous Sign-In / auth provider 系になる。

## 確認方法

本番 Supabase の SQL Editor で以下を確認。

```sql
select proname, pg_get_function_arguments(oid)
from pg_proc
where pronamespace = 'public'::regnamespace
  and proname in ('create_session', 'join_session');
```

`create_session | p_host_name text` が出なければ migration 未適用。

## 対処

本番 Supabase に最新 migration を適用する。

```bash
npx supabase link --project-ref <prod-project-ref>
npx supabase db push
```

SQL Editor で手動適用する場合は、少なくとも以下を順に適用。

1. `supabase/migrations/20260511000001_fix_participant_insert_vulnerability.sql`
2. `supabase/migrations/20260511000002_create_session_rpc.sql`
3. `supabase/migrations/20260511000003_music_links_update_policy.sql`
4. `supabase/migrations/20260511000004_ensure_session_rpcs.sql`

その後、Authentication > Providers > Anonymous Sign Ins が有効であることも確認。
