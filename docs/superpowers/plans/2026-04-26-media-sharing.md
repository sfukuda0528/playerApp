# メディア共有機能 実装計画

> **Codex 向け:** この計画は現在のセッションでタスクごとに実装してください。サブエージェントは、ユーザーが委任または並列作業を明示的に依頼し、かつアクティブな Codex 実行環境が許可している場合にのみ使用します。手順は追跡用にチェックボックス（`- [ ]`）形式を使用します。

**Goal:** CampCanvas の MainPage に写真アップロード・スライドショー・音楽リンク共有機能を追加する。

**Architecture:** Approach A（役割分岐）。`sessions.host_auth_id` でホスト判定し、同一 `/session/:sessionId` ルートでホスト view（Slideshow＋全機能）と参加者 view（PhotoUpload＋MusicPanel のみ）を切り替える。写真は Supabase Storage、テーブルは photos / music_links を新設。

**Tech Stack:** React 19, TypeScript, Supabase (Storage / Realtime / RLS), Vitest, @testing-library/react

---

## ファイルマップ

| 操作 | パス |
|------|------|
| 新規 | `supabase/migrations/20260426000002_media_sharing.sql` |
| 変更 | `src/types/session.ts` |
| 変更 | `src/hooks/useSessionCreate.ts` |
| 変更 | `src/hooks/useSessionCreate.test.ts` |
| 新規 | `src/hooks/usePhotos.ts` + `usePhotos.test.ts` |
| 新規 | `src/hooks/useUploadPhoto.ts` + `useUploadPhoto.test.ts` |
| 新規 | `src/hooks/useMusicLinks.ts` + `useMusicLinks.test.ts` |
| 新規 | `src/hooks/useAddMusicLink.ts` + `useAddMusicLink.test.ts` |
| 新規 | `src/components/Slideshow.tsx` + `Slideshow.test.tsx` |
| 新規 | `src/components/PhotoUpload.tsx` + `PhotoUpload.test.tsx` |
| 新規 | `src/components/MusicPanel.tsx` + `MusicPanel.test.tsx` |
| 変更 | `src/components/MainPage.tsx` |
| 変更 | `src/components/MainPage.test.tsx` |

---

## Task 1: DB migration + 型定義

**Files:**
- Create: `supabase/migrations/20260426000002_media_sharing.sql`
- Modify: `src/types/session.ts`

- [ ] **Step 1: マイグレーションファイルを作成**

```sql
-- supabase/migrations/20260426000002_media_sharing.sql

-- sessions に host_auth_id 追加
ALTER TABLE public.sessions ADD COLUMN host_auth_id uuid;

-- photos テーブル
CREATE TABLE public.photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  uploader_auth_id uuid NOT NULL,
  storage_path text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.photos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "photos: read own session"
  ON public.photos FOR SELECT
  USING (
    session_id IN (
      SELECT session_id FROM public.participants WHERE auth_id = auth.uid()
    )
  );

CREATE POLICY "photos: insert own"
  ON public.photos FOR INSERT
  WITH CHECK (
    uploader_auth_id = auth.uid() AND
    session_id IN (
      SELECT session_id FROM public.participants WHERE auth_id = auth.uid()
    )
  );

CREATE POLICY "photos: delete own"
  ON public.photos FOR DELETE
  USING (uploader_auth_id = auth.uid());

CREATE INDEX ON public.photos(session_id);
ALTER PUBLICATION supabase_realtime ADD TABLE public.photos;

-- music_links テーブル
CREATE TABLE public.music_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  added_by_auth_id uuid NOT NULL,
  url text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.music_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "music_links: read own session"
  ON public.music_links FOR SELECT
  USING (
    session_id IN (
      SELECT session_id FROM public.participants WHERE auth_id = auth.uid()
    )
  );

CREATE POLICY "music_links: insert own"
  ON public.music_links FOR INSERT
  WITH CHECK (
    added_by_auth_id = auth.uid() AND
    session_id IN (
      SELECT session_id FROM public.participants WHERE auth_id = auth.uid()
    )
  );

CREATE POLICY "music_links: delete own"
  ON public.music_links FOR DELETE
  USING (added_by_auth_id = auth.uid());

CREATE INDEX ON public.music_links(session_id);
ALTER PUBLICATION supabase_realtime ADD TABLE public.music_links;
```

注: Supabase Storage バケット `photos` はダッシュボードまたは CLI で作成し、public アクセスを有効にすること。

- [ ] **Step 2: 型定義を更新**

`src/types/session.ts` を以下に置き換える:

```ts
export type SessionStatus = 'active' | 'ended'

export interface Session {
  id: string
  code: string
  host_name: string
  host_auth_id: string
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

- [ ] **Step 3: コミット**

```bash
git add supabase/migrations/20260426000002_media_sharing.sql src/types/session.ts
git commit -m "feat: media sharing DB migration + Photo/MusicLink types"
```

---

## Task 2: useSessionCreate に host_auth_id を追加

**Files:**
- Modify: `src/hooks/useSessionCreate.ts`
- Modify: `src/hooks/useSessionCreate.test.ts`

- [ ] **Step 1: テストを更新（失敗する状態にする）**

`src/hooks/useSessionCreate.test.ts` の `vi.hoisted` と mock を以下に更新:

```ts
import { renderHook, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useSessionCreate } from './useSessionCreate'

const { mockSignInAnonymously, mockSessionInsert, mockInsertArgs, mockParticipantInsert } = vi.hoisted(() => ({
  mockSignInAnonymously: vi.fn(),
  mockSessionInsert: vi.fn(),
  mockInsertArgs: vi.fn(),
  mockParticipantInsert: vi.fn(),
}))

vi.mock('../lib/supabase', () => ({
  supabase: {
    auth: { signInAnonymously: mockSignInAnonymously },
    from: (table: string) => {
      if (table === 'sessions') {
        return {
          insert: (args: unknown) => {
            mockInsertArgs(args)
            return { select: () => ({ single: mockSessionInsert }) }
          },
        }
      }
      if (table === 'participants') {
        return { insert: () => mockParticipantInsert() }
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
      id: 'sess-1', code: '472819', host_name: 'Alice', host_auth_id: 'anon-uid-123',
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

  it('sessions INSERT に host_auth_id が含まれる', async () => {
    const fakeSession = {
      id: 'sess-1', code: '472819', host_name: 'Alice', host_auth_id: 'anon-uid-123',
      status: 'active', last_active_at: '2026-04-24T10:00:00Z',
      inactivity_timeout_min: 360, created_at: '2026-04-24T10:00:00Z',
    }
    mockSessionInsert.mockResolvedValue({ data: fakeSession, error: null })
    mockParticipantInsert.mockResolvedValue({ data: {}, error: null })

    const { result } = renderHook(() => useSessionCreate())
    await act(async () => { await result.current.createSession('Alice') })

    expect(mockInsertArgs).toHaveBeenCalledWith(
      expect.objectContaining({ host_auth_id: 'anon-uid-123' })
    )
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

- [ ] **Step 2: テスト実行（FAIL を確認）**

```
npx vitest run src/hooks/useSessionCreate.test.ts
```

期待: `sessions INSERT に host_auth_id が含まれる` が FAIL

- [ ] **Step 3: 実装を更新**

`src/hooks/useSessionCreate.ts` の sessions INSERT 部分を変更:

```ts
const { data: session, error: sessionError } = await supabase
  .from('sessions')
  .insert({
    code: generateCode(),
    host_name: hostName,
    host_auth_id: authId,
    status: 'active',
    last_active_at: new Date().toISOString(),
    inactivity_timeout_min: 360,
  })
  .select()
  .single()
```

- [ ] **Step 4: テスト実行（PASS を確認）**

```
npx vitest run src/hooks/useSessionCreate.test.ts
```

期待: 全テスト PASS

- [ ] **Step 5: コミット**

```bash
git add src/hooks/useSessionCreate.ts src/hooks/useSessionCreate.test.ts
git commit -m "feat: add host_auth_id to session create"
```

---

## Task 3: usePhotos フック

**Files:**
- Create: `src/hooks/usePhotos.ts`
- Create: `src/hooks/usePhotos.test.ts`

- [ ] **Step 1: テストを作成**

```ts
// src/hooks/usePhotos.test.ts
import { renderHook, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { usePhotos } from './usePhotos'
import type { Photo } from '../types/session'

const { mockOn, mockChannel, mockRemoveChannel, mockInitialFetch } = vi.hoisted(() => ({
  mockOn: vi.fn(),
  mockChannel: vi.fn(),
  mockRemoveChannel: vi.fn(),
  mockInitialFetch: vi.fn(),
}))

vi.mock('../lib/supabase', () => ({
  supabase: {
    from: () => ({
      select: () => ({ eq: () => ({ order: () => mockInitialFetch() }) }),
    }),
    channel: mockChannel,
    removeChannel: mockRemoveChannel,
  },
}))

const photo1: Photo = {
  id: 'ph-1', session_id: 'sess-1', uploader_auth_id: 'uid-1',
  storage_path: 'sess-1/001_a.jpg', created_at: '2026-04-26T10:00:00Z',
}
const photo2: Photo = {
  id: 'ph-2', session_id: 'sess-1', uploader_auth_id: 'uid-2',
  storage_path: 'sess-1/002_b.jpg', created_at: '2026-04-26T10:01:00Z',
}

describe('usePhotos', () => {
  let handlers: Array<(payload: unknown) => void> = []

  beforeEach(() => {
    vi.clearAllMocks()
    handlers = []
    mockInitialFetch.mockResolvedValue({ data: [photo1], error: null })
    mockOn.mockImplementation((_event: string, _filter: unknown, handler: (payload: unknown) => void) => {
      handlers.push(handler)
      return { on: mockOn, subscribe: vi.fn() }
    })
    mockChannel.mockReturnValue({ on: mockOn })
  })

  it('初期取得: 既存写真リストを返す', async () => {
    const { result } = renderHook(() => usePhotos('sess-1'))
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.photos).toHaveLength(1)
    expect(result.current.photos[0].id).toBe('ph-1')
  })

  it('Realtime INSERT: 新規写真を末尾に追加する', async () => {
    const { result } = renderHook(() => usePhotos('sess-1'))
    await waitFor(() => expect(result.current.loading).toBe(false))

    // handlers[0] = INSERT ハンドラ
    handlers[0]({ new: photo2 })
    await waitFor(() => expect(result.current.photos).toHaveLength(2))
    expect(result.current.photos[1].id).toBe('ph-2')
  })

  it('Realtime DELETE: 該当写真を除去する', async () => {
    const { result } = renderHook(() => usePhotos('sess-1'))
    await waitFor(() => expect(result.current.loading).toBe(false))

    // handlers[1] = DELETE ハンドラ
    handlers[1]({ old: { id: 'ph-1' } })
    await waitFor(() => expect(result.current.photos).toHaveLength(0))
  })

  it('アンマウント時: チャンネルを削除する', () => {
    const { unmount } = renderHook(() => usePhotos('sess-1'))
    unmount()
    expect(mockRemoveChannel).toHaveBeenCalledOnce()
  })
})
```

- [ ] **Step 2: テスト実行（FAIL を確認）**

```
npx vitest run src/hooks/usePhotos.test.ts
```

期待: FAIL（モジュールが存在しない）

- [ ] **Step 3: 実装を作成**

```ts
// src/hooks/usePhotos.ts
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Photo } from '../types/session'

export function usePhotos(sessionId: string) {
  const [photos, setPhotos] = useState<Photo[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    supabase
      .from('photos')
      .select()
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true })
      .then(({ data, error: fetchError }) => {
        if (cancelled) return
        if (fetchError) { setError(fetchError.message); return }
        if (data) setPhotos(data as Photo[])
        setLoading(false)
      })

    const channel = supabase
      .channel(`photos:${sessionId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'photos', filter: `session_id=eq.${sessionId}` },
        (payload) => setPhotos((prev) => [...prev, payload.new as Photo])
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'photos', filter: `session_id=eq.${sessionId}` },
        (payload) => setPhotos((prev) => prev.filter((p) => p.id !== (payload.old as Photo).id))
      )
      .subscribe()

    return () => {
      cancelled = true
      supabase.removeChannel(channel)
    }
  }, [sessionId])

  return { photos, loading, error }
}
```

- [ ] **Step 4: テスト実行（PASS を確認）**

```
npx vitest run src/hooks/usePhotos.test.ts
```

期待: 全テスト PASS

- [ ] **Step 5: コミット**

```bash
git add src/hooks/usePhotos.ts src/hooks/usePhotos.test.ts
git commit -m "feat: usePhotos hook with realtime sync"
```

---

## Task 4: useUploadPhoto フック

**Files:**
- Create: `src/hooks/useUploadPhoto.ts`
- Create: `src/hooks/useUploadPhoto.test.ts`

- [ ] **Step 1: テストを作成**

```ts
// src/hooks/useUploadPhoto.test.ts
import { renderHook, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useUploadPhoto } from './useUploadPhoto'

const { mockGetUser, mockStorageUpload, mockStorageRemove, mockPhotoInsert, mockPhotoDelete } = vi.hoisted(() => ({
  mockGetUser: vi.fn(),
  mockStorageUpload: vi.fn(),
  mockStorageRemove: vi.fn(),
  mockPhotoInsert: vi.fn(),
  mockPhotoDelete: vi.fn(),
}))

vi.mock('../lib/supabase', () => ({
  supabase: {
    auth: { getUser: mockGetUser },
    storage: {
      from: () => ({
        upload: mockStorageUpload,
        remove: mockStorageRemove,
      }),
    },
    from: (table: string) => {
      if (table === 'photos') {
        return {
          insert: () => mockPhotoInsert(),
          delete: () => ({ eq: () => mockPhotoDelete() }),
        }
      }
    },
  },
}))

describe('useUploadPhoto', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetUser.mockResolvedValue({ data: { user: { id: 'uid-1' } } })
  })

  it('upload: Storage upload → photos INSERT の順で呼ぶ', async () => {
    mockStorageUpload.mockResolvedValue({ error: null })
    mockPhotoInsert.mockResolvedValue({ error: null })

    const file = new File(['img'], 'photo.jpg', { type: 'image/jpeg' })
    const { result } = renderHook(() => useUploadPhoto())
    let ok: boolean | undefined
    await act(async () => { ok = await result.current.upload('sess-1', file) })

    expect(ok).toBe(true)
    const uploadCall = mockStorageUpload.mock.invocationCallOrder[0]
    const insertCall = mockPhotoInsert.mock.invocationCallOrder[0]
    expect(uploadCall).toBeLessThan(insertCall)
    expect(mockStorageUpload).toHaveBeenCalledWith(
      expect.stringMatching(/^sess-1\/\d+_photo\.jpg$/),
      file
    )
  })

  it('upload: Storage エラー時は INSERT しない', async () => {
    mockStorageUpload.mockResolvedValue({ error: new Error('storage fail') })

    const file = new File(['img'], 'photo.jpg', { type: 'image/jpeg' })
    const { result } = renderHook(() => useUploadPhoto())
    let ok: boolean | undefined
    await act(async () => { ok = await result.current.upload('sess-1', file) })

    expect(ok).toBe(false)
    expect(mockPhotoInsert).not.toHaveBeenCalled()
    expect(result.current.error).toBeTruthy()
  })

  it('deletePhoto: Storage remove → photos DELETE の順で呼ぶ', async () => {
    mockStorageRemove.mockResolvedValue({ error: null })
    mockPhotoDelete.mockResolvedValue({ error: null })

    const { result } = renderHook(() => useUploadPhoto())
    let ok: boolean | undefined
    await act(async () => { ok = await result.current.deletePhoto('ph-1', 'sess-1/001_a.jpg') })

    expect(ok).toBe(true)
    const removeCall = mockStorageRemove.mock.invocationCallOrder[0]
    const deleteCall = mockPhotoDelete.mock.invocationCallOrder[0]
    expect(removeCall).toBeLessThan(deleteCall)
  })

  it('upload中は loading=true', async () => {
    let resolveUpload!: (v: { error: null }) => void
    mockStorageUpload.mockReturnValue(new Promise((r) => { resolveUpload = r }))

    const file = new File(['img'], 'photo.jpg', { type: 'image/jpeg' })
    const { result } = renderHook(() => useUploadPhoto())
    act(() => { result.current.upload('sess-1', file) })
    expect(result.current.loading).toBe(true)
    await act(async () => { resolveUpload({ error: null }) })
  })
})
```

- [ ] **Step 2: テスト実行（FAIL を確認）**

```
npx vitest run src/hooks/useUploadPhoto.test.ts
```

期待: FAIL（モジュールが存在しない）

- [ ] **Step 3: 実装を作成**

```ts
// src/hooks/useUploadPhoto.ts
import { useState } from 'react'
import { supabase } from '../lib/supabase'

export function useUploadPhoto() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const upload = async (sessionId: string, file: File): Promise<boolean> => {
    setLoading(true)
    setError(null)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('認証が必要です')

      const path = `${sessionId}/${Date.now()}_${file.name}`
      const { error: storageError } = await supabase.storage.from('photos').upload(path, file)
      if (storageError) throw storageError

      const { error: insertError } = await supabase
        .from('photos')
        .insert({ session_id: sessionId, uploader_auth_id: user.id, storage_path: path })
      if (insertError) throw insertError

      return true
    } catch (err) {
      setError(err instanceof Error ? err.message : 'アップロードに失敗しました')
      return false
    } finally {
      setLoading(false)
    }
  }

  const deletePhoto = async (photoId: string, storagePath: string): Promise<boolean> => {
    setLoading(true)
    setError(null)
    try {
      const { error: storageError } = await supabase.storage.from('photos').remove([storagePath])
      if (storageError) throw storageError

      const { error: deleteError } = await supabase.from('photos').delete().eq('id', photoId)
      if (deleteError) throw deleteError

      return true
    } catch (err) {
      setError(err instanceof Error ? err.message : '削除に失敗しました')
      return false
    } finally {
      setLoading(false)
    }
  }

  return { upload, deletePhoto, loading, error }
}
```

- [ ] **Step 4: テスト実行（PASS を確認）**

```
npx vitest run src/hooks/useUploadPhoto.test.ts
```

期待: 全テスト PASS

- [ ] **Step 5: コミット**

```bash
git add src/hooks/useUploadPhoto.ts src/hooks/useUploadPhoto.test.ts
git commit -m "feat: useUploadPhoto hook (upload + deletePhoto)"
```

---

## Task 5: useMusicLinks フック

**Files:**
- Create: `src/hooks/useMusicLinks.ts`
- Create: `src/hooks/useMusicLinks.test.ts`

- [ ] **Step 1: テストを作成**

```ts
// src/hooks/useMusicLinks.test.ts
import { renderHook, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useMusicLinks } from './useMusicLinks'
import type { MusicLink } from '../types/session'

const { mockOn, mockChannel, mockRemoveChannel, mockInitialFetch } = vi.hoisted(() => ({
  mockOn: vi.fn(),
  mockChannel: vi.fn(),
  mockRemoveChannel: vi.fn(),
  mockInitialFetch: vi.fn(),
}))

vi.mock('../lib/supabase', () => ({
  supabase: {
    from: () => ({
      select: () => ({ eq: () => ({ order: () => mockInitialFetch() }) }),
    }),
    channel: mockChannel,
    removeChannel: mockRemoveChannel,
  },
}))

const link1: MusicLink = {
  id: 'ml-1', session_id: 'sess-1', added_by_auth_id: 'uid-1',
  url: 'https://open.spotify.com/track/abc', created_at: '2026-04-26T10:00:00Z',
}
const link2: MusicLink = {
  id: 'ml-2', session_id: 'sess-1', added_by_auth_id: 'uid-2',
  url: 'https://www.youtube.com/watch?v=xyz', created_at: '2026-04-26T10:01:00Z',
}

describe('useMusicLinks', () => {
  let handlers: Array<(payload: unknown) => void> = []

  beforeEach(() => {
    vi.clearAllMocks()
    handlers = []
    mockInitialFetch.mockResolvedValue({ data: [link1], error: null })
    mockOn.mockImplementation((_event: string, _filter: unknown, handler: (payload: unknown) => void) => {
      handlers.push(handler)
      return { on: mockOn, subscribe: vi.fn() }
    })
    mockChannel.mockReturnValue({ on: mockOn })
  })

  it('初期取得: 既存リンクリストを返す', async () => {
    const { result } = renderHook(() => useMusicLinks('sess-1'))
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.links).toHaveLength(1)
    expect(result.current.links[0].id).toBe('ml-1')
  })

  it('Realtime INSERT: 新規リンクを末尾に追加する', async () => {
    const { result } = renderHook(() => useMusicLinks('sess-1'))
    await waitFor(() => expect(result.current.loading).toBe(false))

    handlers[0]({ new: link2 })
    await waitFor(() => expect(result.current.links).toHaveLength(2))
    expect(result.current.links[1].id).toBe('ml-2')
  })

  it('Realtime DELETE: 該当リンクを除去する', async () => {
    const { result } = renderHook(() => useMusicLinks('sess-1'))
    await waitFor(() => expect(result.current.loading).toBe(false))

    handlers[1]({ old: { id: 'ml-1' } })
    await waitFor(() => expect(result.current.links).toHaveLength(0))
  })

  it('アンマウント時: チャンネルを削除する', () => {
    const { unmount } = renderHook(() => useMusicLinks('sess-1'))
    unmount()
    expect(mockRemoveChannel).toHaveBeenCalledOnce()
  })
})
```

- [ ] **Step 2: テスト実行（FAIL を確認）**

```
npx vitest run src/hooks/useMusicLinks.test.ts
```

期待: FAIL

- [ ] **Step 3: 実装を作成**

```ts
// src/hooks/useMusicLinks.ts
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { MusicLink } from '../types/session'

export function useMusicLinks(sessionId: string) {
  const [links, setLinks] = useState<MusicLink[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    supabase
      .from('music_links')
      .select()
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true })
      .then(({ data, error: fetchError }) => {
        if (cancelled) return
        if (fetchError) { setError(fetchError.message); return }
        if (data) setLinks(data as MusicLink[])
        setLoading(false)
      })

    const channel = supabase
      .channel(`music_links:${sessionId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'music_links', filter: `session_id=eq.${sessionId}` },
        (payload) => setLinks((prev) => [...prev, payload.new as MusicLink])
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'music_links', filter: `session_id=eq.${sessionId}` },
        (payload) => setLinks((prev) => prev.filter((l) => l.id !== (payload.old as MusicLink).id))
      )
      .subscribe()

    return () => {
      cancelled = true
      supabase.removeChannel(channel)
    }
  }, [sessionId])

  return { links, loading, error }
}
```

- [ ] **Step 4: テスト実行（PASS を確認）**

```
npx vitest run src/hooks/useMusicLinks.test.ts
```

期待: 全テスト PASS

- [ ] **Step 5: コミット**

```bash
git add src/hooks/useMusicLinks.ts src/hooks/useMusicLinks.test.ts
git commit -m "feat: useMusicLinks hook with realtime sync"
```

---

## Task 6: useAddMusicLink フック

**Files:**
- Create: `src/hooks/useAddMusicLink.ts`
- Create: `src/hooks/useAddMusicLink.test.ts`

- [ ] **Step 1: テストを作成**

```ts
// src/hooks/useAddMusicLink.test.ts
import { renderHook, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useAddMusicLink, isValidMusicUrl } from './useAddMusicLink'

const { mockGetUser, mockLinkInsert, mockLinkDelete } = vi.hoisted(() => ({
  mockGetUser: vi.fn(),
  mockLinkInsert: vi.fn(),
  mockLinkDelete: vi.fn(),
}))

vi.mock('../lib/supabase', () => ({
  supabase: {
    auth: { getUser: mockGetUser },
    from: () => ({
      insert: () => mockLinkInsert(),
      delete: () => ({ eq: () => mockLinkDelete() }),
    }),
  },
}))

describe('isValidMusicUrl', () => {
  it('YouTube watch URL を許可', () => {
    expect(isValidMusicUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe(true)
  })
  it('youtu.be short URL を許可', () => {
    expect(isValidMusicUrl('https://youtu.be/dQw4w9WgXcQ')).toBe(true)
  })
  it('Spotify URL を許可', () => {
    expect(isValidMusicUrl('https://open.spotify.com/track/abc')).toBe(true)
  })
  it('Twitter URL を拒否', () => {
    expect(isValidMusicUrl('https://twitter.com/something')).toBe(false)
  })
  it('任意の文字列を拒否', () => {
    expect(isValidMusicUrl('not a url')).toBe(false)
  })
})

describe('useAddMusicLink', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetUser.mockResolvedValue({ data: { user: { id: 'uid-1' } } })
    mockLinkInsert.mockResolvedValue({ error: null })
    mockLinkDelete.mockResolvedValue({ error: null })
  })

  it('有効URLで addLink: INSERT を呼びtrueを返す', async () => {
    const { result } = renderHook(() => useAddMusicLink())
    let ok: boolean | undefined
    await act(async () => {
      ok = await result.current.addLink('sess-1', 'https://youtu.be/abc')
    })
    expect(ok).toBe(true)
    expect(mockLinkInsert).toHaveBeenCalledOnce()
  })

  it('無効URLで addLink: INSERT を呼ばずfalseを返す', async () => {
    const { result } = renderHook(() => useAddMusicLink())
    let ok: boolean | undefined
    await act(async () => {
      ok = await result.current.addLink('sess-1', 'https://twitter.com/foo')
    })
    expect(ok).toBe(false)
    expect(mockLinkInsert).not.toHaveBeenCalled()
    expect(result.current.error).toBeTruthy()
  })

  it('deleteLink: DELETE を呼びtrueを返す', async () => {
    const { result } = renderHook(() => useAddMusicLink())
    let ok: boolean | undefined
    await act(async () => { ok = await result.current.deleteLink('ml-1') })
    expect(ok).toBe(true)
    expect(mockLinkDelete).toHaveBeenCalledOnce()
  })
})
```

- [ ] **Step 2: テスト実行（FAIL を確認）**

```
npx vitest run src/hooks/useAddMusicLink.test.ts
```

期待: FAIL

- [ ] **Step 3: 実装を作成**

```ts
// src/hooks/useAddMusicLink.ts
import { useState } from 'react'
import { supabase } from '../lib/supabase'

const ALLOWED: RegExp[] = [
  /youtube\.com\/watch/,
  /youtu\.be\//,
  /open\.spotify\.com\//,
]

export function isValidMusicUrl(url: string): boolean {
  return ALLOWED.some((re) => re.test(url))
}

export function useAddMusicLink() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const addLink = async (sessionId: string, url: string): Promise<boolean> => {
    if (!isValidMusicUrl(url)) {
      setError('YouTube または Spotify の URL を入力してください')
      return false
    }
    setLoading(true)
    setError(null)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('認証が必要です')

      const { error: insertError } = await supabase
        .from('music_links')
        .insert({ session_id: sessionId, added_by_auth_id: user.id, url })
      if (insertError) throw insertError

      return true
    } catch (err) {
      setError(err instanceof Error ? err.message : '追加に失敗しました')
      return false
    } finally {
      setLoading(false)
    }
  }

  const deleteLink = async (linkId: string): Promise<boolean> => {
    setLoading(true)
    setError(null)
    try {
      const { error: deleteError } = await supabase.from('music_links').delete().eq('id', linkId)
      if (deleteError) throw deleteError
      return true
    } catch (err) {
      setError(err instanceof Error ? err.message : '削除に失敗しました')
      return false
    } finally {
      setLoading(false)
    }
  }

  return { addLink, deleteLink, loading, error }
}
```

- [ ] **Step 4: テスト実行（PASS を確認）**

```
npx vitest run src/hooks/useAddMusicLink.test.ts
```

期待: 全テスト PASS

- [ ] **Step 5: コミット**

```bash
git add src/hooks/useAddMusicLink.ts src/hooks/useAddMusicLink.test.ts
git commit -m "feat: useAddMusicLink hook with URL validation"
```

---

## Task 7: Slideshow コンポーネント

**Files:**
- Create: `src/components/Slideshow.tsx`
- Create: `src/components/Slideshow.test.tsx`

- [ ] **Step 1: テストを作成**

```tsx
// src/components/Slideshow.test.tsx
import { render, screen, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import Slideshow from './Slideshow'
import type { Photo } from '../types/session'

vi.mock('../lib/supabase', () => ({
  supabase: {
    storage: {
      from: () => ({
        getPublicUrl: (path: string) => ({
          data: { publicUrl: `https://example.com/${path}` },
        }),
      }),
    },
  },
}))

const photo1: Photo = {
  id: 'ph-1', session_id: 'sess-1', uploader_auth_id: 'uid-1',
  storage_path: 'sess-1/001_a.jpg', created_at: '2026-04-26T10:00:00Z',
}
const photo2: Photo = {
  id: 'ph-2', session_id: 'sess-1', uploader_auth_id: 'uid-2',
  storage_path: 'sess-1/002_b.jpg', created_at: '2026-04-26T10:01:00Z',
}

describe('Slideshow', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => { vi.useRealTimers() })

  it('写真なし: プレースホルダーを表示する', () => {
    render(<Slideshow photos={[]} />)
    expect(screen.getByText('写真がまだありません')).toBeInTheDocument()
  })

  it('写真あり: 最初の写真を表示する', () => {
    render(<Slideshow photos={[photo1, photo2]} />)
    expect(screen.getByRole('img')).toHaveAttribute(
      'src', 'https://example.com/sess-1/001_a.jpg'
    )
    expect(screen.getByText('1 / 2')).toBeInTheDocument()
  })

  it('5秒後: 次の写真へ自動進行する', () => {
    render(<Slideshow photos={[photo1, photo2]} />)
    act(() => { vi.advanceTimersByTime(5000) })
    expect(screen.getByRole('img')).toHaveAttribute(
      'src', 'https://example.com/sess-1/002_b.jpg'
    )
    expect(screen.getByText('2 / 2')).toBeInTheDocument()
  })

  it('最後の写真から最初に戻る', () => {
    render(<Slideshow photos={[photo1, photo2]} />)
    act(() => { vi.advanceTimersByTime(10000) })
    expect(screen.getByRole('img')).toHaveAttribute(
      'src', 'https://example.com/sess-1/001_a.jpg'
    )
  })

  it('写真が空の場合タイマーは動作しない', () => {
    render(<Slideshow photos={[]} />)
    act(() => { vi.advanceTimersByTime(5000) })
    expect(screen.getByText('写真がまだありません')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: テスト実行（FAIL を確認）**

```
npx vitest run src/components/Slideshow.test.tsx
```

期待: FAIL

- [ ] **Step 3: 実装を作成**

```tsx
// src/components/Slideshow.tsx
import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import type { Photo } from '../types/session'

interface Props {
  photos: Photo[]
}

export default function Slideshow({ photos }: Props) {
  const [currentIndex, setCurrentIndex] = useState(0)

  useEffect(() => {
    if (photos.length === 0) return
    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % photos.length)
    }, 5000)
    return () => clearInterval(timer)
  }, [photos.length])

  if (photos.length === 0) {
    return <div aria-label="スライドショー">写真がまだありません</div>
  }

  const photo = photos[currentIndex]
  const { data: { publicUrl } } = supabase.storage.from('photos').getPublicUrl(photo.storage_path)

  return (
    <div aria-label="スライドショー">
      <img src={publicUrl} alt={`スライド ${currentIndex + 1}`} />
      <span>{currentIndex + 1} / {photos.length}</span>
    </div>
  )
}
```

- [ ] **Step 4: テスト実行（PASS を確認）**

```
npx vitest run src/components/Slideshow.test.tsx
```

期待: 全テスト PASS

- [ ] **Step 5: コミット**

```bash
git add src/components/Slideshow.tsx src/components/Slideshow.test.tsx
git commit -m "feat: Slideshow component with auto-advance"
```

---

## Task 8: PhotoUpload コンポーネント

**Files:**
- Create: `src/components/PhotoUpload.tsx`
- Create: `src/components/PhotoUpload.test.tsx`

- [ ] **Step 1: テストを作成**

```tsx
// src/components/PhotoUpload.test.tsx
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import PhotoUpload from './PhotoUpload'
import type { Photo } from '../types/session'

const { mockUpload, mockDeletePhoto } = vi.hoisted(() => ({
  mockUpload: vi.fn(),
  mockDeletePhoto: vi.fn(),
}))

vi.mock('../hooks/useUploadPhoto', () => ({
  useUploadPhoto: () => ({
    upload: mockUpload,
    deletePhoto: mockDeletePhoto,
    loading: false,
    error: null,
  }),
}))

vi.mock('../lib/supabase', () => ({
  supabase: {
    storage: {
      from: () => ({
        getPublicUrl: (path: string) => ({
          data: { publicUrl: `https://example.com/${path}` },
        }),
      }),
    },
  },
}))

const myPhoto: Photo = {
  id: 'ph-1', session_id: 'sess-1', uploader_auth_id: 'uid-me',
  storage_path: 'sess-1/001_a.jpg', created_at: '2026-04-26T10:00:00Z',
}
const otherPhoto: Photo = {
  id: 'ph-2', session_id: 'sess-1', uploader_auth_id: 'uid-other',
  storage_path: 'sess-1/002_b.jpg', created_at: '2026-04-26T10:01:00Z',
}

describe('PhotoUpload', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('ファイル選択後にuploadを呼ぶ', async () => {
    mockUpload.mockResolvedValue(true)
    render(
      <PhotoUpload sessionId="sess-1" photos={[]} currentUserId="uid-me" />
    )
    const input = screen.getByLabelText('写真を追加')
    const file = new File(['img'], 'photo.jpg', { type: 'image/jpeg' })
    await userEvent.upload(input, file)
    expect(mockUpload).toHaveBeenCalledWith('sess-1', file)
  })

  it('自分の写真には削除ボタンが表示される', () => {
    render(
      <PhotoUpload sessionId="sess-1" photos={[myPhoto]} currentUserId="uid-me" />
    )
    expect(screen.getByRole('button', { name: '削除' })).toBeInTheDocument()
  })

  it('他人の写真には削除ボタンが表示されない', () => {
    render(
      <PhotoUpload sessionId="sess-1" photos={[otherPhoto]} currentUserId="uid-me" />
    )
    expect(screen.queryByRole('button', { name: '削除' })).not.toBeInTheDocument()
  })

  it('削除ボタンクリックでdeletePhotoを呼ぶ', async () => {
    mockDeletePhoto.mockResolvedValue(true)
    render(
      <PhotoUpload sessionId="sess-1" photos={[myPhoto]} currentUserId="uid-me" />
    )
    await userEvent.click(screen.getByRole('button', { name: '削除' }))
    expect(mockDeletePhoto).toHaveBeenCalledWith('ph-1', 'sess-1/001_a.jpg')
  })

  it('uploadエラー時はエラーメッセージを表示する', async () => {
    const { mockUploadError } = vi.hoisted(() => ({ mockUploadError: vi.fn() }))
    vi.doMock('../hooks/useUploadPhoto', () => ({
      useUploadPhoto: () => ({
        upload: mockUploadError,
        deletePhoto: vi.fn(),
        loading: false,
        error: 'アップロードに失敗しました',
      }),
    }))

    const { default: PhotoUploadWithError } = await import('./PhotoUpload')
    render(
      <PhotoUploadWithError sessionId="sess-1" photos={[]} currentUserId="uid-me" />
    )
    expect(screen.getByRole('alert')).toHaveTextContent('アップロードに失敗しました')
  })
})
```

- [ ] **Step 2: テスト実行（FAIL を確認）**

```
npx vitest run src/components/PhotoUpload.test.tsx
```

期待: FAIL

- [ ] **Step 3: 実装を作成**

```tsx
// src/components/PhotoUpload.tsx
import { supabase } from '../lib/supabase'
import { useUploadPhoto } from '../hooks/useUploadPhoto'
import type { Photo } from '../types/session'

interface Props {
  sessionId: string
  photos: Photo[]
  currentUserId: string
}

export default function PhotoUpload({ sessionId, photos, currentUserId }: Props) {
  const { upload, deletePhoto, loading, error } = useUploadPhoto()

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    await upload(sessionId, file)
    e.target.value = ''
  }

  const myPhotos = photos.filter((p) => p.uploader_auth_id === currentUserId)

  return (
    <div>
      <label>
        写真を追加
        <input
          type="file"
          accept="image/*"
          aria-label="写真を追加"
          onChange={handleFileChange}
          disabled={loading}
        />
      </label>
      {error && <p role="alert">{error}</p>}
      {myPhotos.length > 0 && (
        <ul>
          {myPhotos.map((photo) => {
            const { data: { publicUrl } } = supabase.storage.from('photos').getPublicUrl(photo.storage_path)
            return (
              <li key={photo.id}>
                <img src={publicUrl} alt="アップロード済み写真" style={{ width: 80, height: 80, objectFit: 'cover' }} />
                <button
                  aria-label="削除"
                  onClick={() => deletePhoto(photo.id, photo.storage_path)}
                  disabled={loading}
                >
                  削除
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
```

- [ ] **Step 4: テスト実行（PASS を確認）**

```
npx vitest run src/components/PhotoUpload.test.tsx
```

期待: 全テスト PASS

- [ ] **Step 5: コミット**

```bash
git add src/components/PhotoUpload.tsx src/components/PhotoUpload.test.tsx
git commit -m "feat: PhotoUpload component with delete for own photos"
```

---

## Task 9: MusicPanel コンポーネント

**Files:**
- Create: `src/components/MusicPanel.tsx`
- Create: `src/components/MusicPanel.test.tsx`

- [ ] **Step 1: テストを作成**

```tsx
// src/components/MusicPanel.test.tsx
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import MusicPanel from './MusicPanel'
import type { MusicLink } from '../types/session'

const { mockAddLink, mockDeleteLink, mockLinks } = vi.hoisted(() => ({
  mockAddLink: vi.fn(),
  mockDeleteLink: vi.fn(),
  mockLinks: { value: [] as MusicLink[] },
}))

vi.mock('../hooks/useMusicLinks', () => ({
  useMusicLinks: () => ({ links: mockLinks.value, loading: false, error: null }),
}))

vi.mock('../hooks/useAddMusicLink', () => ({
  useAddMusicLink: () => ({
    addLink: mockAddLink,
    deleteLink: mockDeleteLink,
    loading: false,
    error: null,
  }),
}))

const myLink: MusicLink = {
  id: 'ml-1', session_id: 'sess-1', added_by_auth_id: 'uid-me',
  url: 'https://youtu.be/abc', created_at: '2026-04-26T10:00:00Z',
}
const otherLink: MusicLink = {
  id: 'ml-2', session_id: 'sess-1', added_by_auth_id: 'uid-other',
  url: 'https://open.spotify.com/track/xyz', created_at: '2026-04-26T10:01:00Z',
}

describe('MusicPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockLinks.value = []
  })

  it('URL入力してボタンクリックでaddLinkを呼ぶ', async () => {
    mockAddLink.mockResolvedValue(true)
    render(<MusicPanel sessionId="sess-1" currentUserId="uid-me" />)
    await userEvent.type(screen.getByRole('textbox'), 'https://youtu.be/abc')
    await userEvent.click(screen.getByRole('button', { name: '追加' }))
    expect(mockAddLink).toHaveBeenCalledWith('sess-1', 'https://youtu.be/abc')
  })

  it('自分のリンクには削除ボタンが表示される', () => {
    mockLinks.value = [myLink]
    render(<MusicPanel sessionId="sess-1" currentUserId="uid-me" />)
    expect(screen.getByRole('link', { name: 'https://youtu.be/abc' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '削除' })).toBeInTheDocument()
  })

  it('他人のリンクには削除ボタンが表示されない', () => {
    mockLinks.value = [otherLink]
    render(<MusicPanel sessionId="sess-1" currentUserId="uid-me" />)
    expect(screen.getByRole('link')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '削除' })).not.toBeInTheDocument()
  })

  it('削除ボタンクリックでdeleteLinkを呼ぶ', async () => {
    mockLinks.value = [myLink]
    mockDeleteLink.mockResolvedValue(true)
    render(<MusicPanel sessionId="sess-1" currentUserId="uid-me" />)
    await userEvent.click(screen.getByRole('button', { name: '削除' }))
    expect(mockDeleteLink).toHaveBeenCalledWith('ml-1')
  })

  it('追加成功後: 入力フィールドがクリアされる', async () => {
    mockAddLink.mockResolvedValue(true)
    render(<MusicPanel sessionId="sess-1" currentUserId="uid-me" />)
    const input = screen.getByRole('textbox')
    await userEvent.type(input, 'https://youtu.be/abc')
    await userEvent.click(screen.getByRole('button', { name: '追加' }))
    await waitFor(() => expect(input).toHaveValue(''))
  })
})
```

- [ ] **Step 2: テスト実行（FAIL を確認）**

```
npx vitest run src/components/MusicPanel.test.tsx
```

期待: FAIL

- [ ] **Step 3: 実装を作成**

```tsx
// src/components/MusicPanel.tsx
import { useState } from 'react'
import { useMusicLinks } from '../hooks/useMusicLinks'
import { useAddMusicLink } from '../hooks/useAddMusicLink'
import type { MusicLink } from '../types/session'

interface Props {
  sessionId: string
  currentUserId: string
}

export default function MusicPanel({ sessionId, currentUserId }: Props) {
  const { links } = useMusicLinks(sessionId)
  const { addLink, deleteLink, loading, error } = useAddMusicLink()
  const [url, setUrl] = useState('')

  const handleAdd = async () => {
    const ok = await addLink(sessionId, url)
    if (ok) setUrl('')
  }

  return (
    <div>
      <div>
        <input
          type="text"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="YouTube / Spotify URL"
        />
        <button onClick={handleAdd} disabled={loading || !url.trim()}>
          追加
        </button>
      </div>
      {error && <p role="alert">{error}</p>}
      <ul>
        {links.map((link: MusicLink) => (
          <li key={link.id}>
            <a href={link.url} target="_blank" rel="noopener noreferrer">
              {link.url}
            </a>
            {link.added_by_auth_id === currentUserId && (
              <button
                aria-label="削除"
                onClick={() => deleteLink(link.id)}
                disabled={loading}
              >
                削除
              </button>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}
```

- [ ] **Step 4: テスト実行（PASS を確認）**

```
npx vitest run src/components/MusicPanel.test.tsx
```

期待: 全テスト PASS

- [ ] **Step 5: コミット**

```bash
git add src/components/MusicPanel.tsx src/components/MusicPanel.test.tsx
git commit -m "feat: MusicPanel component with link list and delete"
```

---

## Task 10: MainPage 更新

**Files:**
- Modify: `src/components/MainPage.tsx`
- Modify: `src/components/MainPage.test.tsx`

- [ ] **Step 1: テストを更新（失敗する状態にする）**

`src/components/MainPage.test.tsx` を以下に置き換える:

```tsx
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import MainPage from './MainPage'

const { mockNavigate, mockEndSession, mockRemoveChannel, mockGetUser, realtimeCallbacks } = vi.hoisted(() => ({
  mockNavigate: vi.fn(),
  mockEndSession: vi.fn(),
  mockRemoveChannel: vi.fn(),
  mockGetUser: vi.fn(),
  realtimeCallbacks: { sessionStatus: null as ((payload: { new: { id: string; status: string } }) => void) | null },
}))

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return { ...actual, useNavigate: () => mockNavigate }
})
vi.mock('../hooks/useSessionEnd', () => ({
  useSessionEnd: () => ({ endSession: mockEndSession, loading: false }),
}))
vi.mock('../hooks/usePhotos', () => ({
  usePhotos: () => ({ photos: [], loading: false, error: null }),
}))
vi.mock('./JoinOverlay', () => ({
  default: ({ onClose }: { onClose: () => void }) => (
    <div role="dialog"><button onClick={onClose}>閉じる</button></div>
  ),
}))
vi.mock('./Slideshow', () => ({
  default: () => <div data-testid="slideshow" />,
}))
vi.mock('./PhotoUpload', () => ({
  default: () => <div data-testid="photo-upload" />,
}))
vi.mock('./MusicPanel', () => ({
  default: () => <div data-testid="music-panel" />,
}))
vi.mock('../lib/supabase', () => {
  const channelMock = {
    on: (_e: string, _f: unknown, cb: (payload: { new: { id: string; status: string } }) => void) => {
      realtimeCallbacks.sessionStatus = cb
      return channelMock
    },
    subscribe: () => channelMock,
  }
  return {
    supabase: {
      auth: { getUser: mockGetUser },
      channel: () => channelMock,
      removeChannel: mockRemoveChannel,
    },
  }
})

const fakeSession = {
  id: 'sess-1', code: '472819', host_name: 'Alice', host_auth_id: 'uid-host',
  status: 'active', last_active_at: '', inactivity_timeout_min: 360, created_at: '',
}

function renderAsHost() {
  mockGetUser.mockResolvedValue({ data: { user: { id: 'uid-host' } } })
  return render(
    <MemoryRouter initialEntries={[{ pathname: '/session/sess-1', state: { session: fakeSession } }]}>
      <Routes><Route path="/session/:sessionId" element={<MainPage />} /></Routes>
    </MemoryRouter>
  )
}

function renderAsParticipant() {
  mockGetUser.mockResolvedValue({ data: { user: { id: 'uid-other' } } })
  return render(
    <MemoryRouter initialEntries={[{ pathname: '/session/sess-1', state: { session: fakeSession } }]}>
      <Routes><Route path="/session/:sessionId" element={<MainPage />} /></Routes>
    </MemoryRouter>
  )
}

describe('MainPage - ホスト', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(window, 'confirm').mockReturnValue(true)
  })

  it('Slideshowが表示される', async () => {
    renderAsHost()
    await waitFor(() => expect(screen.getByTestId('slideshow')).toBeInTheDocument())
  })

  it('「＋メンバー」ボタンが存在する', async () => {
    renderAsHost()
    await waitFor(() => expect(screen.getByRole('button', { name: '＋メンバー' })).toBeInTheDocument())
  })

  it('「＋メンバー」クリックでJoinOverlayが表示される', async () => {
    renderAsHost()
    await waitFor(() => screen.getByRole('button', { name: '＋メンバー' }))
    await userEvent.click(screen.getByRole('button', { name: '＋メンバー' }))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('JoinOverlayの閉じるでオーバーレイが非表示になる', async () => {
    renderAsHost()
    await waitFor(() => screen.getByRole('button', { name: '＋メンバー' }))
    await userEvent.click(screen.getByRole('button', { name: '＋メンバー' }))
    await userEvent.click(screen.getByRole('button', { name: '閉じる' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('「セッション終了」確認後にendSessionを呼び/へ遷移', async () => {
    mockEndSession.mockResolvedValue(true)
    renderAsHost()
    await waitFor(() => screen.getByRole('button', { name: 'セッション終了' }))
    await userEvent.click(screen.getByRole('button', { name: 'セッション終了' }))
    expect(mockEndSession).toHaveBeenCalledWith('sess-1')
    expect(mockNavigate).toHaveBeenCalledWith('/')
  })

  it('外部からstatus=endedになったら/へ遷移', async () => {
    renderAsHost()
    await waitFor(() => realtimeCallbacks.sessionStatus !== null)
    realtimeCallbacks.sessionStatus!({ new: { id: 'sess-1', status: 'ended' } })
    expect(mockNavigate).toHaveBeenCalledWith('/')
  })

  it('別セッションのstatus=ended更新では遷移しない', async () => {
    renderAsHost()
    await waitFor(() => realtimeCallbacks.sessionStatus !== null)
    realtimeCallbacks.sessionStatus!({ new: { id: 'other-sess', status: 'ended' } })
    expect(mockNavigate).not.toHaveBeenCalled()
  })
})

describe('MainPage - 参加者', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('Slideshowが表示されない', async () => {
    renderAsParticipant()
    await waitFor(() => expect(screen.getByTestId('photo-upload')).toBeInTheDocument())
    expect(screen.queryByTestId('slideshow')).not.toBeInTheDocument()
  })

  it('「セッション終了」ボタンが表示されない', async () => {
    renderAsParticipant()
    await waitFor(() => expect(screen.getByTestId('photo-upload')).toBeInTheDocument())
    expect(screen.queryByRole('button', { name: 'セッション終了' })).not.toBeInTheDocument()
  })

  it('PhotoUploadとMusicPanelは表示される', async () => {
    renderAsParticipant()
    await waitFor(() => expect(screen.getByTestId('photo-upload')).toBeInTheDocument())
    expect(screen.getByTestId('music-panel')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: テスト実行（FAIL を確認）**

```
npx vitest run src/components/MainPage.test.tsx
```

期待: FAIL（Slideshow/PhotoUpload/MusicPanel モジュールが存在しない、getUser モックなし）

- [ ] **Step 3: MainPage 実装を更新**

`src/components/MainPage.tsx` を以下に置き換える:

```tsx
import { useState, useEffect } from 'react'
import { useNavigate, useLocation, useParams } from 'react-router-dom'
import JoinOverlay from './JoinOverlay'
import Slideshow from './Slideshow'
import PhotoUpload from './PhotoUpload'
import MusicPanel from './MusicPanel'
import { useSessionEnd } from '../hooks/useSessionEnd'
import { usePhotos } from '../hooks/usePhotos'
import { supabase } from '../lib/supabase'
import type { Session } from '../types/session'

export default function MainPage() {
  const { sessionId } = useParams<{ sessionId: string }>()
  const location = useLocation()
  const session = location.state?.session as Session
  const navigate = useNavigate()
  const { endSession, loading } = useSessionEnd()
  const [showJoinOverlay, setShowJoinOverlay] = useState(false)
  const [isHost, setIsHost] = useState(false)
  const [currentUserId, setCurrentUserId] = useState('')
  const { photos } = usePhotos(sessionId!)

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        setCurrentUserId(user.id)
        setIsHost(session?.host_auth_id === user.id)
      }
    })
  }, [session])

  useEffect(() => {
    if (!sessionId) return
    const channel = supabase
      .channel(`session-status:${sessionId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'sessions' },
        (payload) => {
          if (payload.new.id === sessionId && payload.new.status === 'ended') navigate('/')
        }
      )
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [sessionId, navigate])

  const handleEnd = async () => {
    if (!confirm('セッションを終了しますか？')) return
    const ok = await endSession(sessionId!)
    if (ok) navigate('/')
  }

  return (
    <div>
      {isHost && <Slideshow photos={photos} />}
      <PhotoUpload sessionId={sessionId!} photos={photos} currentUserId={currentUserId} />
      <MusicPanel sessionId={sessionId!} currentUserId={currentUserId} />
      {isHost && (
        <>
          <button aria-label="＋メンバー" onClick={() => setShowJoinOverlay(true)}>
            ＋メンバー
          </button>
          <button onClick={handleEnd} disabled={loading}>
            セッション終了
          </button>
        </>
      )}
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

- [ ] **Step 4: テスト実行（PASS を確認）**

```
npx vitest run src/components/MainPage.test.tsx
```

期待: 全テスト PASS

- [ ] **Step 5: 全テスト実行**

```
npx vitest run
```

期待: 全テスト PASS

- [ ] **Step 6: コミット**

```bash
git add src/components/MainPage.tsx src/components/MainPage.test.tsx
git commit -m "feat: MainPage - host/participant view with media sharing"
```

---

## 完了確認チェックリスト

- [ ] `npx vitest run` で全テスト PASS
- [ ] Supabase ダッシュボードで `photos` Storage バケットを public で作成済み
- [ ] マイグレーション `20260426000002_media_sharing.sql` を本番 Supabase に適用済み
