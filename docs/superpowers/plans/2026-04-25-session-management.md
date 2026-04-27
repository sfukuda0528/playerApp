# Session Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** CampCanvasのセッション管理（FR-009）を実装する。グランピング参加者4人がQR/コードで同一セッションに集まり、6時間非アクティブで自動終了する。

**Architecture:** Supabase DB（sessions/participantsテーブル）にデータを永続化し、Realtime WebSocketで状態変化を全クライアントに配信。UI上は名前入力のみだが内部でSupabase Anonymous Sign-Inを実行しauth.uid()でRLSを実現。非アクティブ検知はSupabase Scheduled Edge Functionが担当。

**Tech Stack:** React 18, TypeScript 5, Vite 5, @supabase/supabase-js v2, qrcode, react-router-dom v6, Vitest + @testing-library/react

---

## ファイル構成

```
src/
  lib/
    supabase.ts                    # Supabaseクライアント（シングルトン）
  types/
    session.ts                     # Session, Participant型定義
  hooks/
    useSessionCreate.ts            # セッション作成 + ホスト登録
    useSessionCreate.test.ts
    useSessionJoin.ts              # コード検証 + 参加者登録
    useSessionJoin.test.ts
    useParticipants.ts             # Realtime参加者リスト購読
    useParticipants.test.ts
    useSessionEnd.ts               # セッション終了
    useSessionEnd.test.ts
  components/
    TopPage.tsx                    # トップ画面（開始/参加ボタン）
    TopPage.test.tsx
    SessionCreate.tsx              # ホスト名前入力 → セッション作成
    SessionCreate.test.tsx
    InviteScreen.tsx               # QR + コード + 参加者数 + スタートボタン
    InviteScreen.test.tsx
    SessionJoin.tsx                # コード入力 + 名前入力 → 参加
    SessionJoin.test.tsx
    JoinOverlay.tsx                # ＋メンバーで表示するQRオーバーレイ
    JoinOverlay.test.tsx
    MainPage.tsx                   # メイン画面（スライドショー + ＋メンバー + 終了）
    MainPage.test.tsx
  test/
    setup.ts                      # @testing-library/jest-dom setup
  App.tsx                          # Routerとルート定義
  main.tsx                         # エントリポイント
supabase/
  migrations/
    20260424000000_sessions.sql    # sessions + participants + RLS
  functions/
    session-cleanup/
      index.ts                     # 非アクティブセッション終了Edge Function
```

---

## Task 1: Viteプロジェクトスキャフォールド + Vitestセットアップ

**Files:**
- Create: `package.json`
- Create: `vite.config.ts`
- Create: `tsconfig.json`
- Create: `tsconfig.node.json`
- Create: `index.html`
- Create: `src/main.tsx`
- Create: `src/App.tsx`
- Create: `src/test/setup.ts`
- Create: `.env.local`

- [ ] **Step 1: 既存ファイルを退避してViteスキャフォールド**

```bash
# README.mdとCLAUDE.mdを一時退避
git stash

npm create vite@latest . -- --template react-ts
# "Current directory is not empty" → y を選択

# 退避ファイルを復元
git stash pop
```

- [ ] **Step 2: 依存パッケージインストール**

```bash
npm install @supabase/supabase-js react-router-dom qrcode
npm install -D vitest @vitest/ui jsdom @testing-library/react @testing-library/jest-dom @testing-library/user-event @types/qrcode
```

- [ ] **Step 3: vite.config.ts をVitest対応に更新**

`vite.config.ts` を以下に書き換える:

```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    globals: true,
  },
})
```

- [ ] **Step 4: テストセットアップファイルを作成**

`src/test/setup.ts`:

```typescript
import '@testing-library/jest-dom'
```

- [ ] **Step 5: package.json のscriptsにtestを追加**

`package.json` の `"scripts"` に追記:

```json
"test": "vitest",
"test:ui": "vitest --ui"
```

- [ ] **Step 6: .env.local を作成（Supabase接続情報プレースホルダー）**

```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

実際の値はSupabaseダッシュボードのProject Settings > APIから取得する。

- [ ] **Step 7: ビルドとテストが動くことを確認**

```bash
npm run build
npm test -- --run
```

Expected: ビルド成功、テスト0件でPASS（エラーなし）

- [ ] **Step 8: コミット**

```bash
git add -A
git commit -m "chore: Viteプロジェクトセットアップ + Vitest設定"
```

---

## Task 2: TypeScript型定義 + Supabaseクライアント

**Files:**
- Create: `src/types/session.ts`
- Create: `src/lib/supabase.ts`

- [ ] **Step 1: 型定義ファイルを作成**

`src/types/session.ts`:

```typescript
export type SessionStatus = 'active' | 'ended'

export interface Session {
  id: string
  code: string
  host_name: string
  status: SessionStatus
  last_active_at: string
  inactivity_timeout_min: number
  created_at: string
}

export interface Participant {
  id: string
  session_id: string
  name: string
  auth_id: string
  joined_at: string
}
```

- [ ] **Step 2: Supabaseクライアントを作成**

`src/lib/supabase.ts`:

```typescript
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
```

- [ ] **Step 3: コミット**

```bash
git add src/types/session.ts src/lib/supabase.ts
git commit -m "feat: TypeScript型定義とSupabaseクライアント追加"
```

---

## Task 3: DBマイグレーション（sessions + participants + RLS）

**Files:**
- Create: `supabase/migrations/20260424000000_sessions.sql`

- [ ] **Step 1: Supabase CLIインストール確認**

```bash
npx supabase --version
```

インストールされていない場合:
```bash
npm install -D supabase
```

- [ ] **Step 2: マイグレーションファイルを作成**

`supabase/migrations/20260424000000_sessions.sql`:

```sql
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
```

- [ ] **Step 3: Supabaseローカル環境でマイグレーション適用（ローカル開発用）**

```bash
npx supabase db push
```

または本番Supabaseダッシュボードの「SQL Editor」でSQLを直接実行する。

- [ ] **Step 4: コミット**

```bash
git add supabase/
git commit -m "feat: sessions/participantsテーブルとRLSポリシー追加"
```

---

## Task 4: useSessionCreate フック（TDD）

**Files:**
- Create: `src/hooks/useSessionCreate.ts`
- Create: `src/hooks/useSessionCreate.test.ts`

- [ ] **Step 1: 失敗するテストを書く**

`src/hooks/useSessionCreate.test.ts`:

```typescript
import { renderHook, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useSessionCreate } from './useSessionCreate'

const mockSignInAnonymously = vi.fn()
const mockSessionInsert = vi.fn()
const mockParticipantInsert = vi.fn()

vi.mock('../lib/supabase', () => ({
  supabase: {
    auth: { signInAnonymously: mockSignInAnonymously },
    from: (table: string) => {
      if (table === 'sessions') {
        return {
          insert: () => ({ select: () => ({ single: mockSessionInsert }) }),
        }
      }
      if (table === 'participants') {
        return {
          insert: () => ({ select: () => ({ single: mockParticipantInsert }) }),
        }
      }
    },
  },
}))

describe('useSessionCreate', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSignInAnonymously.mockResolvedValue({
      data: { user: { id: 'anon-uid-123' } },
      error: null,
    })
  })

  it('成功時: Sessionオブジェクトを返す', async () => {
    const fakeSession = {
      id: 'sess-1', code: '472819', host_name: 'Alice',
      status: 'active', last_active_at: '2026-04-24T10:00:00Z',
      inactivity_timeout_min: 360, created_at: '2026-04-24T10:00:00Z',
    }
    mockSessionInsert.mockResolvedValue({ data: fakeSession, error: null })
    mockParticipantInsert.mockResolvedValue({
      data: { id: 'p-1', session_id: 'sess-1', name: 'Alice', auth_id: 'anon-uid-123', joined_at: '2026-04-24T10:00:00Z' },
      error: null,
    })

    const { result } = renderHook(() => useSessionCreate())
    let session: unknown
    await act(async () => { session = await result.current.createSession('Alice') })

    expect(session).toEqual(fakeSession)
    expect(result.current.error).toBeNull()
    expect(result.current.loading).toBe(false)
  })

  it('匿名Auth失敗時: nullを返しerrorをセット', async () => {
    mockSignInAnonymously.mockResolvedValue({
      data: { user: null },
      error: new Error('auth failed'),
    })

    const { result } = renderHook(() => useSessionCreate())
    let session: unknown
    await act(async () => { session = await result.current.createSession('Alice') })

    expect(session).toBeNull()
    expect(result.current.error).toBe('auth failed')
  })

  it('DB INSERT失敗時: nullを返しerrorをセット', async () => {
    mockSessionInsert.mockResolvedValue({ data: null, error: new Error('duplicate code') })

    const { result } = renderHook(() => useSessionCreate())
    let session: unknown
    await act(async () => { session = await result.current.createSession('Alice') })

    expect(session).toBeNull()
    expect(result.current.error).toBeTruthy()
  })
})
```

- [ ] **Step 2: テストが失敗することを確認**

```bash
npm test -- src/hooks/useSessionCreate.test.ts --run
```

Expected: FAIL（useSessionCreateが存在しない）

- [ ] **Step 3: フックを実装**

`src/hooks/useSessionCreate.ts`:

```typescript
import { useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Session } from '../types/session'

function generateCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString()
}

export function useSessionCreate() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const createSession = async (hostName: string): Promise<Session | null> => {
    setLoading(true)
    setError(null)
    try {
      const { data: authData, error: authError } = await supabase.auth.signInAnonymously()
      if (authError) throw authError
      const authId = authData.user!.id

      const { data: session, error: sessionError } = await supabase
        .from('sessions')
        .insert({
          code: generateCode(),
          host_name: hostName,
          status: 'active',
          last_active_at: new Date().toISOString(),
          inactivity_timeout_min: 360,
        })
        .select()
        .single()
      if (sessionError) throw sessionError

      const { error: participantError } = await supabase
        .from('participants')
        .insert({ session_id: session.id, name: hostName, auth_id: authId })
        .select()
        .single()
      if (participantError) throw participantError

      return session as Session
    } catch (err) {
      setError(err instanceof Error ? err.message : 'セッション作成に失敗しました')
      return null
    } finally {
      setLoading(false)
    }
  }

  return { createSession, loading, error }
}
```

- [ ] **Step 4: テストが通ることを確認**

```bash
npm test -- src/hooks/useSessionCreate.test.ts --run
```

Expected: PASS（3件）

- [ ] **Step 5: コミット**

```bash
git add src/hooks/useSessionCreate.ts src/hooks/useSessionCreate.test.ts
git commit -m "feat: useSessionCreateフック実装（TDD）"
```

---

## Task 5: useSessionJoin フック（TDD）

**Files:**
- Create: `src/hooks/useSessionJoin.ts`
- Create: `src/hooks/useSessionJoin.test.ts`

- [ ] **Step 1: 失敗するテストを書く**

`src/hooks/useSessionJoin.test.ts`:

```typescript
import { renderHook, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useSessionJoin } from './useSessionJoin'

const mockSignInAnonymously = vi.fn()
const mockSessionSelect = vi.fn()
const mockCountSelect = vi.fn()
const mockParticipantInsert = vi.fn()
const mockSessionUpdate = vi.fn()

vi.mock('../lib/supabase', () => ({
  supabase: {
    auth: { signInAnonymously: mockSignInAnonymously },
    from: (table: string) => {
      if (table === 'sessions') {
        return {
          select: () => ({ eq: () => ({ eq: () => ({ single: mockSessionSelect }) }) }),
          update: () => ({ eq: () => mockSessionUpdate() }),
        }
      }
      if (table === 'participants') {
        return {
          // count: 'exact' の場合はmockCountSelect、通常selectはparticipant取得
          select: (_col: unknown, opts?: { count: string; head: boolean }) =>
            opts?.count === 'exact'
              ? { eq: () => mockCountSelect() }
              : { eq: () => ({ single: mockParticipantInsert }) },
          insert: () => ({ select: () => ({ single: mockParticipantInsert }) }),
        }
      }
    },
  },
}))

const fakeSession = {
  id: 'sess-1', code: '472819', host_name: 'Alice',
  status: 'active', last_active_at: '2026-04-24T10:00:00Z',
  inactivity_timeout_min: 360, created_at: '2026-04-24T10:00:00Z',
}

describe('useSessionJoin', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSignInAnonymously.mockResolvedValue({
      data: { user: { id: 'anon-uid-456' } }, error: null,
    })
    mockSessionUpdate.mockResolvedValue({ error: null })
  })

  it('成功時: session と participant を返す', async () => {
    mockSessionSelect.mockResolvedValue({ data: fakeSession, error: null })
    mockCountSelect.mockResolvedValue({ count: 1, error: null })
    const fakeParticipant = {
      id: 'p-2', session_id: 'sess-1', name: 'Bob',
      auth_id: 'anon-uid-456', joined_at: '2026-04-24T10:05:00Z',
    }
    mockParticipantInsert.mockResolvedValue({ data: fakeParticipant, error: null })

    const { result } = renderHook(() => useSessionJoin())
    let joinResult: unknown
    await act(async () => { joinResult = await result.current.joinSession('472819', 'Bob') })

    expect(joinResult).toEqual({ session: fakeSession, participant: fakeParticipant })
    expect(result.current.error).toBeNull()
  })

  it('存在しないコード: nullを返し「セッションが見つかりません」をセット', async () => {
    mockSessionSelect.mockResolvedValue({ data: null, error: new Error('not found') })

    const { result } = renderHook(() => useSessionJoin())
    let joinResult: unknown
    await act(async () => { joinResult = await result.current.joinSession('000000', 'Bob') })

    expect(joinResult).toBeNull()
    expect(result.current.error).toBe('セッションが見つかりません')
  })

  it('満員(4人): nullを返し「満員です」をセット', async () => {
    mockSessionSelect.mockResolvedValue({ data: fakeSession, error: null })
    mockCountSelect.mockResolvedValue({ count: 4, error: null })

    const { result } = renderHook(() => useSessionJoin())
    let joinResult: unknown
    await act(async () => { joinResult = await result.current.joinSession('472819', 'Bob') })

    expect(joinResult).toBeNull()
    expect(result.current.error).toBe('このセッションは満員です')
  })
})
```

- [ ] **Step 2: テストが失敗することを確認**

```bash
npm test -- src/hooks/useSessionJoin.test.ts --run
```

Expected: FAIL（useSessionJoinが存在しない）

- [ ] **Step 3: フックを実装**

`src/hooks/useSessionJoin.ts`:

```typescript
import { useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Session, Participant } from '../types/session'

export function useSessionJoin() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const joinSession = async (
    code: string,
    name: string
  ): Promise<{ session: Session; participant: Participant } | null> => {
    setLoading(true)
    setError(null)
    try {
      // 1. セッション検索（sessionsはRLS "read all"なので認証不要）
      const { data: session, error: sessionError } = await supabase
        .from('sessions')
        .select()
        .eq('code', code)
        .eq('status', 'active')
        .single()

      if (sessionError || !session) {
        setError('セッションが見つかりません')
        return null
      }

      // 2. 匿名サインイン（participantsのRLS適用のため、カウント前に実行）
      const { data: authData, error: authError } = await supabase.auth.signInAnonymously()
      if (authError) throw authError
      const authId = authData.user!.id

      // 3. 参加者数チェック（認証済みでRLS通過）
      const { count, error: countError } = await supabase
        .from('participants')
        .select('*', { count: 'exact', head: true })
        .eq('session_id', session.id)

      if (countError) throw countError
      if (count !== null && count >= 4) {
        setError('このセッションは満員です')
        return null
      }

      // 4. 参加者登録
      const { data: participant, error: participantError } = await supabase
        .from('participants')
        .insert({ session_id: session.id, name, auth_id: authId })
        .select()
        .single()
      if (participantError) throw participantError

      await supabase
        .from('sessions')
        .update({ last_active_at: new Date().toISOString() })
        .eq('id', session.id)

      return { session: session as Session, participant: participant as Participant }
    } catch (err) {
      setError(err instanceof Error ? err.message : '参加に失敗しました')
      return null
    } finally {
      setLoading(false)
    }
  }

  return { joinSession, loading, error }
}
```

- [ ] **Step 4: テストが通ることを確認**

```bash
npm test -- src/hooks/useSessionJoin.test.ts --run
```

Expected: PASS（3件）

- [ ] **Step 5: コミット**

```bash
git add src/hooks/useSessionJoin.ts src/hooks/useSessionJoin.test.ts
git commit -m "feat: useSessionJoinフック実装（TDD）"
```

---

## Task 6: useParticipants フック（TDD）

**Files:**
- Create: `src/hooks/useParticipants.ts`
- Create: `src/hooks/useParticipants.test.ts`

- [ ] **Step 1: 失敗するテストを書く**

`src/hooks/useParticipants.test.ts`:

```typescript
import { renderHook, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useParticipants } from './useParticipants'
import type { Participant } from '../types/session'

const mockUnsubscribe = vi.fn()
const mockSubscribe = vi.fn(() => ({ unsubscribe: mockUnsubscribe }))
const mockOn = vi.fn()
const mockChannel = vi.fn()
const mockRemoveChannel = vi.fn()
const mockInitialFetch = vi.fn()

vi.mock('../lib/supabase', () => ({
  supabase: {
    from: () => ({
      select: () => ({ eq: () => mockInitialFetch() }),
    }),
    channel: mockChannel,
    removeChannel: mockRemoveChannel,
  },
}))

const alice: Participant = {
  id: 'p-1', session_id: 'sess-1', name: 'Alice',
  auth_id: 'uid-1', joined_at: '2026-04-24T10:00:00Z',
}
const bob: Participant = {
  id: 'p-2', session_id: 'sess-1', name: 'Bob',
  auth_id: 'uid-2', joined_at: '2026-04-24T10:05:00Z',
}

describe('useParticipants', () => {
  let insertHandler: (payload: { new: Participant }) => void

  beforeEach(() => {
    vi.clearAllMocks()
    mockInitialFetch.mockResolvedValue({ data: [alice], error: null })
    mockOn.mockImplementation((_event: string, _filter: unknown, handler: (payload: { new: Participant }) => void) => {
      insertHandler = handler
      return { subscribe: mockSubscribe }
    })
    mockChannel.mockReturnValue({ on: mockOn })
  })

  it('初期取得: 既存参加者リストを返す', async () => {
    const { result } = renderHook(() => useParticipants('sess-1'))
    await waitFor(() => expect(result.current.participants).toHaveLength(1))
    expect(result.current.participants[0].name).toBe('Alice')
  })

  it('Realtime INSERT: 新規参加者を追加する', async () => {
    const { result } = renderHook(() => useParticipants('sess-1'))
    await waitFor(() => expect(result.current.participants).toHaveLength(1))

    // Realtimeイベントをシミュレート
    insertHandler({ new: bob })
    await waitFor(() => expect(result.current.participants).toHaveLength(2))
    expect(result.current.participants[1].name).toBe('Bob')
  })

  it('アンマウント時: チャンネルを削除する', () => {
    const { unmount } = renderHook(() => useParticipants('sess-1'))
    unmount()
    expect(mockRemoveChannel).toHaveBeenCalledOnce()
  })
})
```

- [ ] **Step 2: テストが失敗することを確認**

```bash
npm test -- src/hooks/useParticipants.test.ts --run
```

Expected: FAIL

- [ ] **Step 3: フックを実装**

`src/hooks/useParticipants.ts`:

```typescript
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Participant } from '../types/session'

export function useParticipants(sessionId: string) {
  const [participants, setParticipants] = useState<Participant[]>([])

  useEffect(() => {
    supabase
      .from('participants')
      .select()
      .eq('session_id', sessionId)
      .then(({ data }) => {
        if (data) setParticipants(data as Participant[])
      })

    const channel = supabase
      .channel(`participants:${sessionId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'participants',
          filter: `session_id=eq.${sessionId}`,
        },
        (payload) => {
          setParticipants((prev) => [...prev, payload.new as Participant])
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [sessionId])

  return { participants }
}
```

- [ ] **Step 4: テストが通ることを確認**

```bash
npm test -- src/hooks/useParticipants.test.ts --run
```

Expected: PASS（3件）

- [ ] **Step 5: コミット**

```bash
git add src/hooks/useParticipants.ts src/hooks/useParticipants.test.ts
git commit -m "feat: useParticipantsフック実装（TDD）"
```

---

## Task 7: useSessionEnd フック（TDD）

**Files:**
- Create: `src/hooks/useSessionEnd.ts`
- Create: `src/hooks/useSessionEnd.test.ts`

- [ ] **Step 1: 失敗するテストを書く**

`src/hooks/useSessionEnd.test.ts`:

```typescript
import { renderHook, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useSessionEnd } from './useSessionEnd'

const mockUpdate = vi.fn()

vi.mock('../lib/supabase', () => ({
  supabase: {
    from: () => ({
      update: () => ({ eq: () => mockUpdate() }),
    }),
  },
}))

describe('useSessionEnd', () => {
  beforeEach(() => vi.clearAllMocks())

  it('成功時: trueを返す', async () => {
    mockUpdate.mockResolvedValue({ error: null })
    const { result } = renderHook(() => useSessionEnd())
    let ok: unknown
    await act(async () => { ok = await result.current.endSession('sess-1') })
    expect(ok).toBe(true)
    expect(result.current.loading).toBe(false)
  })

  it('DB失敗時: falseを返す', async () => {
    mockUpdate.mockResolvedValue({ error: new Error('db error') })
    const { result } = renderHook(() => useSessionEnd())
    let ok: unknown
    await act(async () => { ok = await result.current.endSession('sess-1') })
    expect(ok).toBe(false)
  })
})
```

- [ ] **Step 2: テストが失敗することを確認**

```bash
npm test -- src/hooks/useSessionEnd.test.ts --run
```

Expected: FAIL

- [ ] **Step 3: フックを実装**

`src/hooks/useSessionEnd.ts`:

```typescript
import { useState } from 'react'
import { supabase } from '../lib/supabase'

export function useSessionEnd() {
  const [loading, setLoading] = useState(false)

  const endSession = async (sessionId: string): Promise<boolean> => {
    setLoading(true)
    try {
      const { error } = await supabase
        .from('sessions')
        .update({ status: 'ended' })
        .eq('id', sessionId)
      return !error
    } finally {
      setLoading(false)
    }
  }

  return { endSession, loading }
}
```

- [ ] **Step 4: テストが通ることを確認**

```bash
npm test -- src/hooks/useSessionEnd.test.ts --run
```

Expected: PASS（2件）

- [ ] **Step 5: コミット**

```bash
git add src/hooks/useSessionEnd.ts src/hooks/useSessionEnd.test.ts
git commit -m "feat: useSessionEndフック実装（TDD）"
```

---

## Task 8: App ルーター + TopPage

**Files:**
- Modify: `src/App.tsx`
- Create: `src/components/TopPage.tsx`
- Create: `src/components/TopPage.test.tsx`

- [ ] **Step 1: 失敗するテストを書く**

`src/components/TopPage.test.tsx`:

```typescript
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect, vi } from 'vitest'
import TopPage from './TopPage'

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return { ...actual, useNavigate: () => mockNavigate }
})

describe('TopPage', () => {
  it('「セッション開始」ボタンが存在する', () => {
    render(<MemoryRouter><TopPage /></MemoryRouter>)
    expect(screen.getByRole('button', { name: 'セッション開始' })).toBeInTheDocument()
  })

  it('「セッションに参加」ボタンが存在する', () => {
    render(<MemoryRouter><TopPage /></MemoryRouter>)
    expect(screen.getByRole('button', { name: 'セッションに参加' })).toBeInTheDocument()
  })

  it('「セッション開始」クリックで/createへ遷移', async () => {
    render(<MemoryRouter><TopPage /></MemoryRouter>)
    await userEvent.click(screen.getByRole('button', { name: 'セッション開始' }))
    expect(mockNavigate).toHaveBeenCalledWith('/create')
  })

  it('「セッションに参加」クリックで/joinへ遷移', async () => {
    render(<MemoryRouter><TopPage /></MemoryRouter>)
    await userEvent.click(screen.getByRole('button', { name: 'セッションに参加' }))
    expect(mockNavigate).toHaveBeenCalledWith('/join')
  })
})
```

- [ ] **Step 2: テストが失敗することを確認**

```bash
npm test -- src/components/TopPage.test.tsx --run
```

Expected: FAIL

- [ ] **Step 3: TopPageコンポーネントを実装**

`src/components/TopPage.tsx`:

```typescript
import { useNavigate } from 'react-router-dom'

export default function TopPage() {
  const navigate = useNavigate()
  return (
    <div>
      <h1>CampCanvas</h1>
      <button onClick={() => navigate('/create')}>セッション開始</button>
      <button onClick={() => navigate('/join')}>セッションに参加</button>
    </div>
  )
}
```

- [ ] **Step 4: App.tsx のルーター設定を更新**

`src/App.tsx`:

```typescript
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import TopPage from './components/TopPage'
import SessionCreate from './components/SessionCreate'
import InviteScreen from './components/InviteScreen'
import SessionJoin from './components/SessionJoin'
import MainPage from './components/MainPage'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<TopPage />} />
        <Route path="/create" element={<SessionCreate />} />
        <Route path="/invite/:sessionId" element={<InviteScreen />} />
        <Route path="/join/:code?" element={<SessionJoin />} />
        <Route path="/session/:sessionId" element={<MainPage />} />
      </Routes>
    </BrowserRouter>
  )
}
```

※ 他コンポーネントは次のタスクで作成。現時点ではimportエラーになるため、一時的に各コンポーネントのダミーファイルを作成する:

```bash
echo "export default function SessionCreate() { return null }" > src/components/SessionCreate.tsx
echo "export default function InviteScreen() { return null }" > src/components/InviteScreen.tsx
echo "export default function SessionJoin() { return null }" > src/components/SessionJoin.tsx
echo "export default function MainPage() { return null }" > src/components/MainPage.tsx
```

- [ ] **Step 5: テストが通ることを確認**

```bash
npm test -- src/components/TopPage.test.tsx --run
```

Expected: PASS（4件）

- [ ] **Step 6: コミット**

```bash
git add src/App.tsx src/components/TopPage.tsx src/components/TopPage.test.tsx \
  src/components/SessionCreate.tsx src/components/InviteScreen.tsx \
  src/components/SessionJoin.tsx src/components/MainPage.tsx
git commit -m "feat: Appルーター + TopPageコンポーネント実装"
```

---

## Task 9: SessionCreate コンポーネント（TDD）

**Files:**
- Modify: `src/components/SessionCreate.tsx`（ダミーを本実装に差し替え）
- Create: `src/components/SessionCreate.test.tsx`

- [ ] **Step 1: 失敗するテストを書く**

`src/components/SessionCreate.test.tsx`:

```typescript
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import SessionCreate from './SessionCreate'

const mockNavigate = vi.fn()
const mockCreateSession = vi.fn()

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return { ...actual, useNavigate: () => mockNavigate }
})
vi.mock('../hooks/useSessionCreate', () => ({
  useSessionCreate: () => ({
    createSession: mockCreateSession,
    loading: false,
    error: null,
  }),
}))

describe('SessionCreate', () => {
  beforeEach(() => vi.clearAllMocks())

  it('名前入力フォームが存在する', () => {
    render(<MemoryRouter><SessionCreate /></MemoryRouter>)
    expect(screen.getByPlaceholderText('ニックネーム')).toBeInTheDocument()
  })

  it('名前が空の場合ボタンが無効', () => {
    render(<MemoryRouter><SessionCreate /></MemoryRouter>)
    expect(screen.getByRole('button', { name: 'セッションを作成' })).toBeDisabled()
  })

  it('成功時: /invite/:sessionIdへ遷移', async () => {
    const fakeSession = { id: 'sess-1', code: '472819' }
    mockCreateSession.mockResolvedValue(fakeSession)

    render(<MemoryRouter><SessionCreate /></MemoryRouter>)
    await userEvent.type(screen.getByPlaceholderText('ニックネーム'), 'Alice')
    await userEvent.click(screen.getByRole('button', { name: 'セッションを作成' }))

    await waitFor(() =>
      expect(mockNavigate).toHaveBeenCalledWith('/invite/sess-1', {
        state: { session: fakeSession },
      })
    )
  })

  it('失敗時: エラーメッセージを表示', async () => {
    vi.mock('../hooks/useSessionCreate', () => ({
      useSessionCreate: () => ({
        createSession: vi.fn().mockResolvedValue(null),
        loading: false,
        error: 'セッション作成に失敗しました',
      }),
    }))
    render(<MemoryRouter><SessionCreate /></MemoryRouter>)
    expect(await screen.findByText('セッション作成に失敗しました')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: テストが失敗することを確認**

```bash
npm test -- src/components/SessionCreate.test.tsx --run
```

Expected: FAIL

- [ ] **Step 3: コンポーネントを実装（ダミーを差し替え）**

`src/components/SessionCreate.tsx`:

```typescript
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSessionCreate } from '../hooks/useSessionCreate'

export default function SessionCreate() {
  const [name, setName] = useState('')
  const navigate = useNavigate()
  const { createSession, loading, error } = useSessionCreate()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    const session = await createSession(name.trim())
    if (session) navigate(`/invite/${session.id}`, { state: { session } })
  }

  return (
    <form onSubmit={handleSubmit}>
      <h2>あなたの名前を入力</h2>
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="ニックネーム"
      />
      {error && <p role="alert">{error}</p>}
      <button type="submit" disabled={loading || !name.trim()}>
        {loading ? '作成中...' : 'セッションを作成'}
      </button>
    </form>
  )
}
```

- [ ] **Step 4: テストが通ることを確認**

```bash
npm test -- src/components/SessionCreate.test.tsx --run
```

Expected: PASS

- [ ] **Step 5: コミット**

```bash
git add src/components/SessionCreate.tsx src/components/SessionCreate.test.tsx
git commit -m "feat: SessionCreateコンポーネント実装"
```

---

## Task 10: InviteScreen コンポーネント（TDD）

**Files:**
- Modify: `src/components/InviteScreen.tsx`（ダミーを本実装に差し替え）
- Create: `src/components/InviteScreen.test.tsx`

- [ ] **Step 1: qrcodeモジュールのモックを準備してテストを書く**

`src/components/InviteScreen.test.tsx`:

```typescript
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import InviteScreen from './InviteScreen'

const mockNavigate = vi.fn()

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return { ...actual, useNavigate: () => mockNavigate }
})
vi.mock('qrcode', () => ({
  default: { toDataURL: vi.fn().mockResolvedValue('data:image/png;base64,mock') },
}))
vi.mock('../hooks/useParticipants', () => ({
  useParticipants: () => ({ participants: [{ id: 'p-1', name: 'Alice' }] }),
}))

const fakeSession = {
  id: 'sess-1', code: '472819', host_name: 'Alice',
  status: 'active', last_active_at: '', inactivity_timeout_min: 360, created_at: '',
}

function renderWithRoute() {
  return render(
    <MemoryRouter initialEntries={[{ pathname: '/invite/sess-1', state: { session: fakeSession } }]}>
      <Routes>
        <Route path="/invite/:sessionId" element={<InviteScreen />} />
      </Routes>
    </MemoryRouter>
  )
}

describe('InviteScreen', () => {
  beforeEach(() => vi.clearAllMocks())

  it('6桁コードを表示する', async () => {
    renderWithRoute()
    expect(await screen.findByText('472819')).toBeInTheDocument()
  })

  it('QR画像を表示する', async () => {
    renderWithRoute()
    expect(await screen.findByAltText('QR Code')).toBeInTheDocument()
  })

  it('参加者数を表示する', async () => {
    renderWithRoute()
    expect(await screen.findByText(/1 \/ 4 人/)).toBeInTheDocument()
  })

  it('スタートボタンクリックで/session/:idへ遷移', async () => {
    renderWithRoute()
    await userEvent.click(await screen.findByRole('button', { name: 'スタート' }))
    expect(mockNavigate).toHaveBeenCalledWith('/session/sess-1', {
      state: { session: fakeSession },
    })
  })
})
```

- [ ] **Step 2: テストが失敗することを確認**

```bash
npm test -- src/components/InviteScreen.test.tsx --run
```

Expected: FAIL

- [ ] **Step 3: コンポーネントを実装**

`src/components/InviteScreen.tsx`:

```typescript
import { useEffect, useState } from 'react'
import { useNavigate, useParams, useLocation } from 'react-router-dom'
import QRCode from 'qrcode'
import { useParticipants } from '../hooks/useParticipants'
import type { Session } from '../types/session'

export default function InviteScreen() {
  const { sessionId } = useParams<{ sessionId: string }>()
  const location = useLocation()
  const session = location.state?.session as Session
  const navigate = useNavigate()
  const [qrUrl, setQrUrl] = useState('')
  const { participants } = useParticipants(sessionId!)

  const joinUrl = `${window.location.origin}/join/${session?.code}`

  useEffect(() => {
    if (session?.code) {
      QRCode.toDataURL(joinUrl).then(setQrUrl)
    }
  }, [joinUrl, session?.code])

  return (
    <div>
      <h2>メンバーを招待</h2>
      {qrUrl && <img src={qrUrl} alt="QR Code" />}
      <p>{session?.code}</p>
      <p>{participants.length} / 4 人参加中</p>
      <button onClick={() => navigate(`/session/${sessionId}`, { state: { session } })}>
        スタート
      </button>
    </div>
  )
}
```

- [ ] **Step 4: テストが通ることを確認**

```bash
npm test -- src/components/InviteScreen.test.tsx --run
```

Expected: PASS（4件）

- [ ] **Step 5: コミット**

```bash
git add src/components/InviteScreen.tsx src/components/InviteScreen.test.tsx
git commit -m "feat: InviteScreen（QR表示 + 参加者数カウント）実装"
```

---

## Task 11: SessionJoin コンポーネント（TDD）

**Files:**
- Modify: `src/components/SessionJoin.tsx`（ダミーを本実装に差し替え）
- Create: `src/components/SessionJoin.test.tsx`

- [ ] **Step 1: 失敗するテストを書く**

`src/components/SessionJoin.test.tsx`:

```typescript
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import SessionJoin from './SessionJoin'

const mockNavigate = vi.fn()
const mockJoinSession = vi.fn()

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return { ...actual, useNavigate: () => mockNavigate }
})
vi.mock('../hooks/useSessionJoin', () => ({
  useSessionJoin: () => ({
    joinSession: mockJoinSession,
    loading: false,
    error: null,
  }),
}))

function renderAtPath(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/join/:code?" element={<SessionJoin />} />
      </Routes>
    </MemoryRouter>
  )
}

describe('SessionJoin', () => {
  beforeEach(() => vi.clearAllMocks())

  it('URLのコードパラメータをコード欄に自動入力', () => {
    renderAtPath('/join/472819')
    expect(screen.getByDisplayValue('472819')).toBeInTheDocument()
  })

  it('コードと名前が空の場合ボタンが無効', () => {
    renderAtPath('/join')
    expect(screen.getByRole('button', { name: '参加する' })).toBeDisabled()
  })

  it('成功時: /session/:idへ遷移', async () => {
    const fakeResult = {
      session: { id: 'sess-1', code: '472819' },
      participant: { id: 'p-2' },
    }
    mockJoinSession.mockResolvedValue(fakeResult)

    renderAtPath('/join/472819')
    await userEvent.type(screen.getByPlaceholderText('ニックネーム'), 'Bob')
    await userEvent.click(screen.getByRole('button', { name: '参加する' }))

    await waitFor(() =>
      expect(mockNavigate).toHaveBeenCalledWith('/session/sess-1', {
        state: { session: fakeResult.session },
      })
    )
  })
})
```

- [ ] **Step 2: テストが失敗することを確認**

```bash
npm test -- src/components/SessionJoin.test.tsx --run
```

Expected: FAIL

- [ ] **Step 3: コンポーネントを実装**

`src/components/SessionJoin.tsx`:

```typescript
import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useSessionJoin } from '../hooks/useSessionJoin'

export default function SessionJoin() {
  const { code: urlCode } = useParams<{ code?: string }>()
  const [code, setCode] = useState(urlCode ?? '')
  const [name, setName] = useState('')
  const navigate = useNavigate()
  const { joinSession, loading, error } = useSessionJoin()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!code.trim() || !name.trim()) return
    const result = await joinSession(code.trim(), name.trim())
    if (result) navigate(`/session/${result.session.id}`, { state: { session: result.session } })
  }

  return (
    <form onSubmit={handleSubmit}>
      <h2>セッションに参加</h2>
      <input
        value={code}
        onChange={(e) => setCode(e.target.value)}
        placeholder="6桁コード"
        maxLength={6}
      />
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="ニックネーム"
      />
      {error && <p role="alert">{error}</p>}
      <button type="submit" disabled={loading || !code.trim() || !name.trim()}>
        {loading ? '参加中...' : '参加する'}
      </button>
    </form>
  )
}
```

- [ ] **Step 4: テストが通ることを確認**

```bash
npm test -- src/components/SessionJoin.test.tsx --run
```

Expected: PASS（3件）

- [ ] **Step 5: コミット**

```bash
git add src/components/SessionJoin.tsx src/components/SessionJoin.test.tsx
git commit -m "feat: SessionJoinコンポーネント実装"
```

---

## Task 12: JoinOverlay + MainPage コンポーネント（TDD）

**Files:**
- Create: `src/components/JoinOverlay.tsx`
- Create: `src/components/JoinOverlay.test.tsx`
- Modify: `src/components/MainPage.tsx`（ダミーを本実装に差し替え）
- Create: `src/components/MainPage.test.tsx`

- [ ] **Step 1: JoinOverlayのテストを書く**

`src/components/JoinOverlay.test.tsx`:

```typescript
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import JoinOverlay from './JoinOverlay'

vi.mock('qrcode', () => ({
  default: { toDataURL: vi.fn().mockResolvedValue('data:image/png;base64,mock') },
}))
vi.mock('../hooks/useParticipants', () => ({
  useParticipants: () => ({ participants: [{ id: 'p-1' }, { id: 'p-2' }] }),
}))

describe('JoinOverlay', () => {
  const onClose = vi.fn()
  const defaultProps = { sessionId: 'sess-1', code: '472819', onClose }

  it('dialog roleで表示される', () => {
    render(<JoinOverlay {...defaultProps} />)
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('6桁コードを表示する', async () => {
    render(<JoinOverlay {...defaultProps} />)
    expect(await screen.findByText('472819')).toBeInTheDocument()
  })

  it('QR画像を表示する', async () => {
    render(<JoinOverlay {...defaultProps} />)
    expect(await screen.findByAltText('QR Code')).toBeInTheDocument()
  })

  it('参加者数を表示する', async () => {
    render(<JoinOverlay {...defaultProps} />)
    expect(await screen.findByText(/2 \/ 4 人/)).toBeInTheDocument()
  })

  it('閉じるボタンクリックでonCloseが呼ばれる', async () => {
    render(<JoinOverlay {...defaultProps} />)
    await userEvent.click(screen.getByRole('button', { name: '閉じる' }))
    expect(onClose).toHaveBeenCalledOnce()
  })
})
```

- [ ] **Step 2: JoinOverlayが失敗することを確認**

```bash
npm test -- src/components/JoinOverlay.test.tsx --run
```

Expected: FAIL

- [ ] **Step 3: JoinOverlayを実装**

`src/components/JoinOverlay.tsx`:

```typescript
import { useEffect, useState } from 'react'
import QRCode from 'qrcode'
import { useParticipants } from '../hooks/useParticipants'

interface Props {
  sessionId: string
  code: string
  onClose: () => void
}

export default function JoinOverlay({ sessionId, code, onClose }: Props) {
  const [qrUrl, setQrUrl] = useState('')
  const { participants } = useParticipants(sessionId)
  const joinUrl = `${window.location.origin}/join/${code}`

  useEffect(() => {
    QRCode.toDataURL(joinUrl).then(setQrUrl)
  }, [joinUrl])

  return (
    <div role="dialog" aria-label="メンバー追加">
      <h2>メンバーを追加</h2>
      {qrUrl && <img src={qrUrl} alt="QR Code" />}
      <p>{code}</p>
      <p>{participants.length} / 4 人参加中</p>
      <button onClick={onClose}>閉じる</button>
    </div>
  )
}
```

- [ ] **Step 4: MainPageのテストを書く**

`src/components/MainPage.test.tsx`:

```typescript
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import MainPage from './MainPage'

const mockNavigate = vi.fn()
const mockEndSession = vi.fn()

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return { ...actual, useNavigate: () => mockNavigate }
})
vi.mock('../hooks/useSessionEnd', () => ({
  useSessionEnd: () => ({ endSession: mockEndSession, loading: false }),
}))
vi.mock('./JoinOverlay', () => ({
  default: ({ onClose }: { onClose: () => void }) => (
    <div role="dialog"><button onClick={onClose}>閉じる</button></div>
  ),
}))

const fakeSession = {
  id: 'sess-1', code: '472819', host_name: 'Alice',
  status: 'active', last_active_at: '', inactivity_timeout_min: 360, created_at: '',
}

function renderWithRoute() {
  return render(
    <MemoryRouter initialEntries={[{ pathname: '/session/sess-1', state: { session: fakeSession } }]}>
      <Routes>
        <Route path="/session/:sessionId" element={<MainPage />} />
      </Routes>
    </MemoryRouter>
  )
}

describe('MainPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(window, 'confirm').mockReturnValue(true)
  })

  it('「＋メンバー」ボタンが存在する', () => {
    renderWithRoute()
    expect(screen.getByRole('button', { name: '＋メンバー' })).toBeInTheDocument()
  })

  it('「＋メンバー」クリックでJoinOverlayが表示される', async () => {
    renderWithRoute()
    await userEvent.click(screen.getByRole('button', { name: '＋メンバー' }))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('JoinOverlayの閉じるでオーバーレイが非表示になる', async () => {
    renderWithRoute()
    await userEvent.click(screen.getByRole('button', { name: '＋メンバー' }))
    await userEvent.click(screen.getByRole('button', { name: '閉じる' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('「セッション終了」確認後にendSessionを呼び/へ遷移', async () => {
    mockEndSession.mockResolvedValue(true)
    renderWithRoute()
    await userEvent.click(screen.getByRole('button', { name: 'セッション終了' }))
    expect(mockEndSession).toHaveBeenCalledWith('sess-1')
    expect(mockNavigate).toHaveBeenCalledWith('/')
  })
})
```

- [ ] **Step 5: MainPageのテストが失敗することを確認**

```bash
npm test -- src/components/MainPage.test.tsx --run
```

Expected: FAIL

- [ ] **Step 6: MainPageを実装（ダミーを差し替え）**

`src/components/MainPage.tsx`:

```typescript
import { useState } from 'react'
import { useNavigate, useLocation, useParams } from 'react-router-dom'
import JoinOverlay from './JoinOverlay'
import { useSessionEnd } from '../hooks/useSessionEnd'
import type { Session } from '../types/session'

export default function MainPage() {
  const { sessionId } = useParams<{ sessionId: string }>()
  const location = useLocation()
  const session = location.state?.session as Session
  const navigate = useNavigate()
  const { endSession, loading } = useSessionEnd()
  const [showJoinOverlay, setShowJoinOverlay] = useState(false)

  const handleEnd = async () => {
    if (!confirm('セッションを終了しますか？')) return
    const ok = await endSession(sessionId!)
    if (ok) navigate('/')
  }

  return (
    <div>
      <div aria-label="スライドショー">スライドショー表示エリア</div>
      <button aria-label="＋メンバー" onClick={() => setShowJoinOverlay(true)}>
        ＋メンバー
      </button>
      <button onClick={handleEnd} disabled={loading}>
        セッション終了
      </button>
      {showJoinOverlay && session && (
        <JoinOverlay
          sessionId={sessionId!}
          code={session.code}
          onClose={() => setShowJoinOverlay(false)}
        />
      )}
    </div>
  )
}
```

- [ ] **Step 7: 全テストが通ることを確認**

```bash
npm test -- --run
```

Expected: 全件PASS

- [ ] **Step 8: コミット**

```bash
git add src/components/JoinOverlay.tsx src/components/JoinOverlay.test.tsx \
  src/components/MainPage.tsx src/components/MainPage.test.tsx
git commit -m "feat: JoinOverlay + MainPageコンポーネント実装"
```

---

## Task 13: Edge Function（非アクティブセッション自動終了）

**Files:**
- Create: `supabase/functions/session-cleanup/index.ts`

- [ ] **Step 1: Edge Functionを作成**

`supabase/functions/session-cleanup/index.ts`:

```typescript
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

Deno.serve(async () => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  const { data: sessions, error } = await supabase
    .from('sessions')
    .select('id, last_active_at, inactivity_timeout_min')
    .eq('status', 'active')

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const now = Date.now()
  const toEnd = (sessions ?? []).filter((s) => {
    const lastActive = new Date(s.last_active_at).getTime()
    const timeoutMs = s.inactivity_timeout_min * 60 * 1000
    return now - lastActive > timeoutMs
  })

  if (toEnd.length > 0) {
    await supabase
      .from('sessions')
      .update({ status: 'ended' })
      .in('id', toEnd.map((s) => s.id))
  }

  return new Response(JSON.stringify({ checked: sessions?.length ?? 0, ended: toEnd.length }), {
    headers: { 'Content-Type': 'application/json' },
  })
})
```

- [ ] **Step 2: Supabaseダッシュボードでスケジュールを設定**

Supabaseダッシュボード → Edge Functions → `session-cleanup` をデプロイ後、
「Scheduled」タブで以下を設定:

```
Cron expression: */5 * * * *   （5分ごと）
```

- [ ] **Step 3: ローカルでEdge Functionをテスト**

```bash
npx supabase functions serve session-cleanup
# 別ターミナルで:
curl -i http://localhost:54321/functions/v1/session-cleanup
```

Expected: `{"checked":N,"ended":M}` のJSONレスポンス

- [ ] **Step 4: コミット**

```bash
git add supabase/functions/
git commit -m "feat: session-cleanup Edge Function実装（5分ごと非アクティブ検知）"
```

---

## 全体動作確認

- [ ] `npm run dev` でアプリを起動し、以下を手動確認:
  1. トップ → セッション開始 → 名前入力 → QRコード + 6桁コードが表示される
  2. 別タブで「セッションに参加」→ コード入力（またはQRスキャンURLを貼り付け）→ 名前入力 → アップロード画面
  3. メイン画面の「＋メンバー」タップでQRオーバーレイ表示 → 「閉じる」で非表示
  4. 「セッション終了」→ 確認ダイアログ → トップへ遷移
