# Synced Music Queue Implementation Plan

> **Codex 向け:** この計画は現在のセッションでタスクごとに実装してください。サブエージェントは、ユーザーが委任または並列作業を明示的に依頼し、かつアクティブな Codex 実行環境が許可している場合にのみ使用します。手順は追跡用にチェックボックス（`- [ ]`）形式を使用します。

**Goal:** Host playback state becomes the shared source of truth so every participant sees the same current queue item and play/pause state.

**Architecture:** Keep `music_links` responsible for queue membership and order. Add `music_playback_state` as one row per session, synced through Supabase Realtime, with host-only writes. Replace `MusicPanel`'s local `currentIndex` source of truth with `current_music_link_id` derived from synced playback state.

**Tech Stack:** React, TypeScript, Supabase Postgres/RLS/Realtime, Vitest, Testing Library.

---

## File Structure

- Create `supabase/migrations/20260513000002_music_playback_state.sql`: database table, indexes, RLS, Realtime publication, and trigger for `updated_at`.
- Modify `src/types/session.ts`: add `MusicPlaybackState`.
- Create `src/hooks/useMusicPlaybackState.ts`: fetch and subscribe to one playback state row; expose host mutation helpers.
- Create `src/hooks/useMusicPlaybackState.test.ts`: unit tests for fetch, Realtime, upsert, update, and error behavior.
- Modify `src/components/MusicPanel.tsx`: derive current item from playback state, update shared state for host controls, and keep queue display synchronized.
- Modify `src/components/MusicPanel.test.tsx`: mock the new hook and verify current item, play/pause, next/end, deletion, and reorder behavior.

## Task 1: Playback State Types And Migration

**Files:**
- Create: `supabase/migrations/20260513000002_music_playback_state.sql`
- Modify: `src/types/session.ts`

- [ ] **Step 1: Add `MusicPlaybackState` type**

Edit `src/types/session.ts` after `MusicLink`:

```ts
export interface MusicPlaybackState {
  session_id: string
  current_music_link_id: string | null
  is_playing: boolean
  updated_by_auth_id: string
  updated_at: string
}
```

- [ ] **Step 2: Add migration**

Create `supabase/migrations/20260513000002_music_playback_state.sql`:

```sql
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
```

- [ ] **Step 3: Verify typecheck baseline**

Run: `npm test -- --run src/utils/youtube.test.ts`

Expected: PASS. This confirms the test runner still works before queue-specific changes.

- [ ] **Step 4: Commit**

Run:

```bash
git add src/types/session.ts supabase/migrations/20260513000002_music_playback_state.sql
git commit -m "feat: add music playback state schema"
```

## Task 2: `useMusicPlaybackState`

**Files:**
- Create: `src/hooks/useMusicPlaybackState.ts`
- Create: `src/hooks/useMusicPlaybackState.test.ts`

- [ ] **Step 1: Write failing hook tests**

Create `src/hooks/useMusicPlaybackState.test.ts`:

```ts
import { act, renderHook, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useMusicPlaybackState } from './useMusicPlaybackState'
import type { MusicPlaybackState } from '../types/session'

const {
  mockGetUser, mockSelectSingle, mockUpsert, mockUpdate, mockOn,
  mockSubscribe, mockChannel, mockRemoveChannel,
} = vi.hoisted(() => ({
  mockGetUser: vi.fn(),
  mockSelectSingle: vi.fn(),
  mockUpsert: vi.fn(),
  mockUpdate: vi.fn(),
  mockOn: vi.fn(),
  mockSubscribe: vi.fn(),
  mockChannel: vi.fn(),
  mockRemoveChannel: vi.fn(),
}))

vi.mock('../lib/supabase', () => ({
  supabase: {
    auth: { getUser: mockGetUser },
    from: (table: string) => ({
      select: () => ({ eq: () => ({ maybeSingle: mockSelectSingle }) }),
      upsert: (data: unknown) => mockUpsert(data),
      update: (data: unknown) => ({ eq: () => mockUpdate(data) }),
    }),
    channel: mockChannel,
    removeChannel: mockRemoveChannel,
  },
}))

const state1: MusicPlaybackState = {
  session_id: 'sess-1',
  current_music_link_id: 'ml-1',
  is_playing: true,
  updated_by_auth_id: 'uid-host',
  updated_at: '2026-05-13T00:00:00Z',
}

describe('useMusicPlaybackState', () => {
  let handlers: Array<(payload: unknown) => void> = []

  beforeEach(() => {
    vi.clearAllMocks()
    handlers = []
    mockGetUser.mockResolvedValue({ data: { user: { id: 'uid-host' } } })
    mockSelectSingle.mockResolvedValue({ data: state1, error: null })
    mockUpsert.mockResolvedValue({ error: null })
    mockUpdate.mockResolvedValue({ error: null })
    const channelApi = { on: mockOn, subscribe: mockSubscribe }
    mockOn.mockImplementation((_event: string, _filter: unknown, handler: (payload: unknown) => void) => {
      handlers.push(handler)
      return channelApi
    })
    mockSubscribe.mockImplementation((callback?: (status: string) => void) => {
      callback?.('SUBSCRIBED')
      return channelApi
    })
    mockChannel.mockReturnValue(channelApi)
  })

  it('初期取得: 購読確立後に playback state を返す', async () => {
    const { result } = renderHook(() => useMusicPlaybackState('sess-1'))
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.state).toEqual(state1)
  })

  it('初期取得は Realtime 購読確立後に開始する', () => {
    mockSubscribe.mockImplementation(() => ({ on: mockOn, subscribe: mockSubscribe }))
    const { result } = renderHook(() => useMusicPlaybackState('sess-1'))
    expect(mockSelectSingle).not.toHaveBeenCalled()
    expect(result.current.loading).toBe(true)
  })

  it('Realtime INSERT/UPDATE で state を置き換える', async () => {
    const { result } = renderHook(() => useMusicPlaybackState('sess-1'))
    await waitFor(() => expect(result.current.loading).toBe(false))
    const nextState = { ...state1, current_music_link_id: 'ml-2', is_playing: false }
    act(() => { handlers[0]({ new: nextState }) })
    expect(result.current.state).toEqual(nextState)
    act(() => { handlers[1]({ new: state1 }) })
    expect(result.current.state).toEqual(state1)
  })

  it('setCurrent: 現在曲と再生状態を upsert する', async () => {
    const { result } = renderHook(() => useMusicPlaybackState('sess-1'))
    await waitFor(() => expect(result.current.loading).toBe(false))
    let ok: boolean | undefined
    await act(async () => {
      ok = await result.current.setCurrent('ml-2', true)
    })
    expect(ok).toBe(true)
    expect(mockUpsert).toHaveBeenCalledWith({
      session_id: 'sess-1',
      current_music_link_id: 'ml-2',
      is_playing: true,
      updated_by_auth_id: 'uid-host',
    })
  })

  it('setPlaying: 再生状態のみ update する', async () => {
    const { result } = renderHook(() => useMusicPlaybackState('sess-1'))
    await waitFor(() => expect(result.current.loading).toBe(false))
    let ok: boolean | undefined
    await act(async () => {
      ok = await result.current.setPlaying(false)
    })
    expect(ok).toBe(true)
    expect(mockUpdate).toHaveBeenCalledWith({
      is_playing: false,
      updated_by_auth_id: 'uid-host',
    })
  })

  it('アンマウント時: チャンネルを削除する', () => {
    const { unmount } = renderHook(() => useMusicPlaybackState('sess-1'))
    unmount()
    expect(mockRemoveChannel).toHaveBeenCalledOnce()
  })
})
```

- [ ] **Step 2: Run failing tests**

Run: `npm test -- --run src/hooks/useMusicPlaybackState.test.ts`

Expected: FAIL because `./useMusicPlaybackState` does not exist.

- [ ] **Step 3: Implement hook**

Create `src/hooks/useMusicPlaybackState.ts`:

```ts
import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { MusicPlaybackState } from '../types/session'

export function useMusicPlaybackState(sessionId: string) {
  const [state, setState] = useState<MusicPlaybackState | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    const fetchState = () => {
      supabase
        .from('music_playback_state')
        .select()
        .eq('session_id', sessionId)
        .maybeSingle()
        .then(({ data, error: fetchError }) => {
          if (cancelled) return
          if (fetchError) {
            setError(fetchError.message)
            setLoading(false)
            return
          }
          setState(data ? data as MusicPlaybackState : null)
          setLoading(false)
        })
    }

    const channel = supabase
      .channel(`music_playback_state:${sessionId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'music_playback_state', filter: `session_id=eq.${sessionId}` },
        (payload) => setState(payload.new as MusicPlaybackState)
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'music_playback_state', filter: `session_id=eq.${sessionId}` },
        (payload) => setState(payload.new as MusicPlaybackState)
      )
      .subscribe((status) => {
        if (cancelled) return
        if (status === 'SUBSCRIBED') {
          fetchState()
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          setError('キューの同期に失敗しました')
          setLoading(false)
        }
      })

    return () => {
      cancelled = true
      supabase.removeChannel(channel)
    }
  }, [sessionId])

  const setCurrent = useCallback(async (linkId: string | null, isPlaying: boolean): Promise<boolean> => {
    setError(null)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('認証が必要です')
      const { error: upsertError } = await supabase
        .from('music_playback_state')
        .upsert({
          session_id: sessionId,
          current_music_link_id: linkId,
          is_playing: isPlaying,
          updated_by_auth_id: user.id,
        })
      if (upsertError) throw upsertError
      return true
    } catch (err) {
      setError(err instanceof Error ? err.message : 'キューの同期に失敗しました')
      return false
    }
  }, [sessionId])

  const setPlaying = useCallback(async (isPlaying: boolean): Promise<boolean> => {
    setError(null)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('認証が必要です')
      const { error: updateError } = await supabase
        .from('music_playback_state')
        .update({
          is_playing: isPlaying,
          updated_by_auth_id: user.id,
        })
        .eq('session_id', sessionId)
      if (updateError) throw updateError
      return true
    } catch (err) {
      setError(err instanceof Error ? err.message : 'キューの同期に失敗しました')
      return false
    }
  }, [sessionId])

  return { state, loading, error, setCurrent, setPlaying }
}
```

- [ ] **Step 4: Run hook tests**

Run: `npm test -- --run src/hooks/useMusicPlaybackState.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

Run:

```bash
git add src/hooks/useMusicPlaybackState.ts src/hooks/useMusicPlaybackState.test.ts
git commit -m "feat: sync music playback state"
```

## Task 3: Replace Local Current Index In `MusicPanel`

**Files:**
- Modify: `src/components/MusicPanel.tsx`
- Modify: `src/components/MusicPanel.test.tsx`

- [ ] **Step 1: Add failing component tests for synced current item**

Update the `useMusicLinks` mock in `src/components/MusicPanel.test.tsx` so `capturedOptions` also stores `onUpdate` if needed, then add a `useMusicPlaybackState` mock:

```ts
const {
  mockSetCurrent, mockSetPlaying, mockPlaybackState,
} = vi.hoisted(() => ({
  mockSetCurrent: vi.fn(),
  mockSetPlaying: vi.fn(),
  mockPlaybackState: { value: null as { current_music_link_id: string | null; is_playing: boolean } | null },
}))

vi.mock('../hooks/useMusicPlaybackState', () => ({
  useMusicPlaybackState: () => ({
    state: mockPlaybackState.value,
    loading: false,
    error: null,
    setCurrent: mockSetCurrent,
    setPlaying: mockSetPlaying,
  }),
}))
```

In `beforeEach`, reset:

```ts
mockPlaybackState.value = null
mockSetCurrent.mockResolvedValue(true)
mockSetPlaying.mockResolvedValue(true)
```

Add tests:

```ts
it('playback state の current_music_link_id の曲に aria-current が付与される', () => {
  mockLinks.value = [link1, link2]
  mockPlaybackState.value = { current_music_link_id: 'ml-2', is_playing: true }
  render(<MusicPanel sessionId="sess-1" currentUserId="uid-me" isHost={true} />)
  const items = screen.getAllByRole('listitem')
  expect(items[0]).not.toHaveAttribute('aria-current', 'true')
  expect(items[1]).toHaveAttribute('aria-current', 'true')
  expect(screen.getByTestId('youtube-player')).toHaveAttribute('data-video-id', 'abc1234')
})

it('ホストの再生切り替えで playback state を更新する', async () => {
  mockLinks.value = [link1]
  mockPlaybackState.value = { current_music_link_id: 'ml-1', is_playing: false }
  mockYouTubePlayer.mockImplementation(({ onPlayToggle }: { onPlayToggle: () => void }) => (
    <button type="button" onClick={onPlayToggle}>toggle-player</button>
  ))
  render(<MusicPanel sessionId="sess-1" currentUserId="uid-me" isHost={true} />)
  await userEvent.click(screen.getByRole('button', { name: 'toggle-player' }))
  expect(mockSetPlaying).toHaveBeenCalledWith(true)
})

it('曲終了時に次曲へ playback state を進めて現在曲を削除する', async () => {
  mockLinks.value = [link1, link2]
  mockPlaybackState.value = { current_music_link_id: 'ml-1', is_playing: true }
  mockYouTubePlayer.mockImplementation(({ onEnded }: { onEnded: () => void }) => (
    <button type="button" onClick={onEnded}>end-player</button>
  ))
  render(<MusicPanel sessionId="sess-1" currentUserId="uid-me" isHost={true} />)
  await userEvent.click(screen.getByRole('button', { name: 'end-player' }))
  expect(mockSetCurrent).toHaveBeenCalledWith('ml-2', true)
  expect(mockDeleteLink).toHaveBeenCalledWith('ml-1')
})
```

- [ ] **Step 2: Run failing component tests**

Run: `npm test -- --run src/components/MusicPanel.test.tsx`

Expected: FAIL because `MusicPanel` still uses local `currentIndex` and does not import `useMusicPlaybackState`.

- [ ] **Step 3: Implement synced playback in `MusicPanel`**

Make these edits in `src/components/MusicPanel.tsx`:

```ts
import { useMusicPlaybackState } from '../hooks/useMusicPlaybackState'
```

Replace local `currentIndex`/`isPlaying` source of truth:

```ts
const { state: playbackState, error: playbackError, setCurrent, setPlaying } = useMusicPlaybackState(sessionId)
const currentIndex = playbackState?.current_music_link_id
  ? links.findIndex(link => link.id === playbackState.current_music_link_id)
  : -1
const currentLink = currentIndex >= 0 ? links[currentIndex] : undefined
const isPlaying = playbackState?.is_playing ?? false
```

Remove `useState(0)` for `currentIndex`, `useState(false)` for `isPlaying`, `currentIndexRef`, and `onUpdate` index-shift logic.

Add host-only correction effect:

```ts
useEffect(() => {
  if (!isHost) return
  if (links.length === 0) {
    if (playbackState?.current_music_link_id || playbackState?.is_playing) {
      void setCurrent(null, false)
    }
    return
  }
  const currentId = playbackState?.current_music_link_id
  if (!currentId || !links.some(link => link.id === currentId)) {
    void setCurrent(links[0].id, true)
  }
}, [isHost, links, playbackState?.current_music_link_id, playbackState?.is_playing, setCurrent])
```

Update host controls:

```ts
onPlayToggle={() => void setPlaying(!isPlaying)}
onPrev={() => {
  if (links.length === 0) return
  const prevIndex = currentIndex > 0 ? currentIndex - 1 : links.length - 1
  void setCurrent(links[prevIndex].id, true)
}}
onNext={() => void handleEnded()}
```

Update add handlers: if a new insert arrives and there is no playback state, host correction effect sets it. Do not update local current index in `onInsert`.

Update `handleEnded`:

```ts
const handleEnded = async () => {
  if (!currentLink) return
  const nextLink = links[currentIndex + 1] ?? null
  const okState = await setCurrent(nextLink?.id ?? null, !!nextLink)
  if (!okState) return
  const okDelete = await deleteLink(currentLink.id)
  if (okDelete) optimisticDelete(currentLink.id)
}
```

Update `handleDelete`:

```ts
const handleDelete = async (link: MusicLink, index: number) => {
  if (link.id === playbackState?.current_music_link_id) {
    const nextLink = links[index + 1] ?? links[index - 1] ?? null
    const okState = await setCurrent(nextLink?.id ?? null, !!nextLink)
    if (!okState) return
  }
  const ok = await deleteLink(link.id)
  if (ok) optimisticDelete(link.id)
}
```

Update error display to include `playbackError`:

```tsx
{(error ?? playbackError ?? playlistError) && (
  <p role="alert" className="text-camp-destructive text-xs">{error ?? playbackError ?? playlistError}</p>
)}
```

- [ ] **Step 4: Run component tests**

Run: `npm test -- --run src/components/MusicPanel.test.tsx`

Expected: PASS after updating older tests that expected local index behavior to now expect playback state behavior.

- [ ] **Step 5: Commit**

Run:

```bash
git add src/components/MusicPanel.tsx src/components/MusicPanel.test.tsx
git commit -m "feat: drive music panel from synced playback state"
```

## Task 4: Regression Verification

**Files:**
- Verify: queue-related tests and typecheck

- [ ] **Step 1: Run hook and component test set**

Run:

```bash
npm test -- --run src/hooks/useMusicPlaybackState.test.ts src/hooks/useMusicLinks.test.ts src/hooks/useAddMusicLink.test.ts src/hooks/useReorderMusicLink.test.ts src/components/MusicPanel.test.tsx src/components/YouTubePlayer.test.tsx
```

Expected: PASS.

- [ ] **Step 2: Run full test suite**

Run: `npm test -- --run`

Expected: PASS.

- [ ] **Step 3: Run typecheck**

Run: `npm run build`

Expected: PASS.

- [ ] **Step 4: Commit any verification-only fixes**

If tests reveal small compile or mock drift fixes in the queue work, commit the queue files from this plan:

```bash
git add src/types/session.ts src/hooks/useMusicPlaybackState.ts src/hooks/useMusicPlaybackState.test.ts src/components/MusicPanel.tsx src/components/MusicPanel.test.tsx supabase/migrations/20260513000002_music_playback_state.sql
git commit -m "test: cover synced music queue regressions"
```
