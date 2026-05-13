create table public.music_playback_state (
  session_id uuid primary key references public.sessions(id) on delete cascade,
  current_music_link_id uuid references public.music_links(id) on delete set null,
  is_playing boolean not null default false,
  updated_by_auth_id uuid not null,
  updated_at timestamptz not null default now()
);

alter table public.music_playback_state enable row level security;

create policy "music_playback_state: read own session"
  on public.music_playback_state for select
  using (
    session_id in (
      select session_id from public.participants where auth_id = auth.uid()
    )
  );

create policy "music_playback_state: host insert"
  on public.music_playback_state for insert
  with check (
    updated_by_auth_id = auth.uid()
    and exists (
      select 1 from public.sessions
      where sessions.id = music_playback_state.session_id
        and sessions.host_auth_id = auth.uid()
    )
  );

create policy "music_playback_state: host update"
  on public.music_playback_state for update
  using (
    exists (
      select 1 from public.sessions
      where sessions.id = music_playback_state.session_id
        and sessions.host_auth_id = auth.uid()
    )
  )
  with check (
    updated_by_auth_id = auth.uid()
    and exists (
      select 1 from public.sessions
      where sessions.id = music_playback_state.session_id
        and sessions.host_auth_id = auth.uid()
    )
  );

create or replace function public.set_music_playback_state_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger set_music_playback_state_updated_at
before update on public.music_playback_state
for each row
execute function public.set_music_playback_state_updated_at();

alter publication supabase_realtime add table public.music_playback_state;
