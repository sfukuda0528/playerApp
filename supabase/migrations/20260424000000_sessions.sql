-- sessions テーブル
create table public.sessions (
  id uuid primary key default gen_random_uuid(),
  code char(6) not null unique,
  host_name text not null,
  status text not null default 'active'
    check (status in ('active', 'ended')),
  last_active_at timestamptz not null default now(),
  inactivity_timeout_min int not null default 360,
  created_at timestamptz not null default now()
);

-- participants テーブル
create table public.participants (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions(id) on delete cascade,
  name text not null,
  auth_id uuid not null,
  joined_at timestamptz not null default now()
);

-- RLS有効化
alter table public.sessions enable row level security;
alter table public.participants enable row level security;

-- sessions ポリシー
-- コードによる読み取り（参加前の検証用）は全員許可
create policy "sessions: read all"
  on public.sessions for select
  using (true);

-- 認証済みユーザーのみ作成可
create policy "sessions: insert for authenticated"
  on public.sessions for insert
  with check (auth.uid() is not null);

-- 参加者が所属するセッションのみ更新可
create policy "sessions: update for participants"
  on public.sessions for update
  using (
    exists (
      select 1 from public.participants
      where session_id = sessions.id
        and auth_id = auth.uid()
    )
  );

-- participants ポリシー
-- 自分が所属するセッションの参加者のみ参照可
create policy "participants: read own session"
  on public.participants for select
  using (
    session_id in (
      select session_id from public.participants
      where auth_id = auth.uid()
    )
    -- コード検証フロー用: 未参加ユーザーでもセッション存在確認に必要
    or auth.uid() is not null
  );

-- 自分のauth_idに紐づくINSERTのみ許可
create policy "participants: insert own"
  on public.participants for insert
  with check (auth_id = auth.uid());

-- Realtime有効化
alter publication supabase_realtime add table public.participants;
alter publication supabase_realtime add table public.sessions;
