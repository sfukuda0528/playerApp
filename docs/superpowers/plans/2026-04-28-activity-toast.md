# 写真・音楽追加者通知トースト 実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 写真または音楽が追加されたとき、追加者名をリアルタイムトーストでヘッダー直下に3秒表示する。

**Architecture:** `usePhotos` に `onInsert` コールバックを追加（`useMusicLinks` 既存パターンと統一）。`MusicPanel` に `onMusicAdd` prop を追加してコールバックをチェーン。`MainPage` でトースト state を管理し、`auth_id → 参加者名` を解決して表示する。

**Tech Stack:** React 19, TypeScript, Vitest, @testing-library/react

---

## ファイルマップ

| ファイル | 変更種別 | 内容 |
|---|---|---|
| `src/hooks/usePhotos.ts` | Modify | `onInsert` コールバックオプション追加 |
| `src/hooks/usePhotos.test.ts` | Modify | `onInsert` テスト追加 |
| `src/components/MusicPanel.tsx` | Modify | `onMusicAdd` prop 追加 |
| `src/components/MusicPanel.test.tsx` | Modify | `onMusicAdd` テスト追加 |
| `src/components/MainPage.tsx` | Modify | トースト state・コールバック・JSX 追加 |
| `src/components/MainPage.test.tsx` | Modify | モック更新・トーストテスト追加 |

---

## Task 1: usePhotos に onInsert コールバックを追加

**Files:**
- Modify: `src/hooks/usePhotos.ts`
- Test: `src/hooks/usePhotos.test.ts`

- [ ] **Step 1: 失敗テストを書く**

`src/hooks/usePhotos.test.ts` の `describe('usePhotos')` ブロック末尾に追加：

```ts
it('Realtime INSERT: onInsert コールバックを呼ぶ', async () => {
  const onInsert = vi.fn()
  const { result } = renderHook(() => usePhotos('sess-1', { onInsert }))
  await waitFor(() => expect(result.current.loading).toBe(false))
  handlers[0]({ new: photo2 })
  await waitFor(() => expect(onInsert).toHaveBeenCalledWith(photo2))
})
```

- [ ] **Step 2: テストが失敗することを確認**

```bash
npx vitest run src/hooks/usePhotos.test.ts
```

期待: `FAIL` — `onInsert` が呼ばれない

- [ ] **Step 3: usePhotos に onInsert を実装**

`src/hooks/usePhotos.ts` を以下に置き換え：

```ts
import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Photo } from '../types/session'

export function usePhotos(
  sessionId: string,
  options?: { onInsert?: (photo: Photo) => void }
) {
  const [photos, setPhotos] = useState<Photo[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const onInsertRef = useRef(options?.onInsert)
  useEffect(() => { onInsertRef.current = options?.onInsert })

  useEffect(() => {
    let cancelled = false

    supabase
      .from('photos')
      .select()
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true })
      .then(({ data, error: fetchError }) => {
        if (cancelled) return
        if (fetchError) { setError(fetchError.message); setLoading(false); return }
        if (data) setPhotos(data as Photo[])
        setLoading(false)
      })

    const channel = supabase
      .channel(`photos:${sessionId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'photos', filter: `session_id=eq.${sessionId}` },
        (payload) => {
          const newPhoto = payload.new as Photo
          setPhotos((prev) => [...prev, newPhoto])
          onInsertRef.current?.(newPhoto)
        }
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

- [ ] **Step 4: テストが全て通ることを確認**

```bash
npx vitest run src/hooks/usePhotos.test.ts
```

期待: `PASS` 全5件

- [ ] **Step 5: コミット**

```bash
git add src/hooks/usePhotos.ts src/hooks/usePhotos.test.ts
git commit -m "feat: usePhotos に onInsert コールバックを追加"
```

---

## Task 2: MusicPanel に onMusicAdd prop を追加

**Files:**
- Modify: `src/components/MusicPanel.tsx`
- Test: `src/components/MusicPanel.test.tsx`

- [ ] **Step 1: 失敗テストを書く**

`src/components/MusicPanel.test.tsx` の `describe('MusicPanel')` ブロック末尾に追加：

```ts
it('INSERT 到着時: onMusicAdd コールバックを呼ぶ', () => {
  const onMusicAdd = vi.fn()
  mockLinks.value = [link1]
  render(<MusicPanel sessionId="sess-1" currentUserId="uid-me" onMusicAdd={onMusicAdd} />)
  act(() => { capturedOptions.onInsert?.(link2) })
  expect(onMusicAdd).toHaveBeenCalledWith(link2)
})
```

- [ ] **Step 2: テストが失敗することを確認**

```bash
npx vitest run src/components/MusicPanel.test.tsx
```

期待: `FAIL` — `onMusicAdd` prop が存在しない

- [ ] **Step 3: MusicPanel に onMusicAdd prop を実装**

`src/components/MusicPanel.tsx` の Props インターフェースと本体を更新：

```tsx
import { useEffect, useState } from 'react'
import { useMusicLinks } from '../hooks/useMusicLinks'
import { useAddMusicLink } from '../hooks/useAddMusicLink'
import YouTubePlayer from './YouTubePlayer'
import { extractYouTubeId } from '../utils/youtube'
import type { MusicLink } from '../types/session'

interface Props {
  sessionId: string
  currentUserId: string
  onMusicAdd?: (link: MusicLink) => void
}

export default function MusicPanel({ sessionId, currentUserId, onMusicAdd }: Props) {
  const { links } = useMusicLinks(sessionId, {
    onInsert: (link) => {
      setIsPlaying((prev) => prev || true)
      onMusicAdd?.(link)
    },
  })
  const { addLink, deleteLink, loading, error } = useAddMusicLink()
  const [url, setUrl] = useState('')
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [restartKey, setRestartKey] = useState(0)

  useEffect(() => {
    if (links.length === 0 || currentIndex >= links.length) {
      setIsPlaying(false)
      setCurrentIndex(0)
    }
  }, [links.length, currentIndex])

  const handleAdd = async () => {
    const ok = await addLink(sessionId, url)
    if (ok) setUrl('')
  }

  const handleDelete = async (link: MusicLink, index: number) => {
    const isCurrent = index === currentIndex
    const ok = await deleteLink(link.id)
    if (!ok) return
    if (isCurrent) {
      setIsPlaying(false)
      setCurrentIndex(0)
    } else if (index < currentIndex) {
      setCurrentIndex((prev) => prev - 1)
    }
  }

  const handleEnded = async () => {
    if (!currentLink) return
    await deleteLink(currentLink.id)
    setRestartKey((k) => k + 1)
  }

  const currentLink = links[currentIndex]
  const videoId = currentLink ? extractYouTubeId(currentLink.url) : null

  return (
    <div className="flex flex-col h-full">
      <div className="bg-camp-dark px-4 py-4 flex flex-col gap-3">
        {videoId ? (
          <YouTubePlayer
            key={`${currentIndex}-${restartKey}`}
            videoId={videoId}
            isPlaying={isPlaying}
            onPlayToggle={() => setIsPlaying((p) => !p)}
            onEnded={handleEnded}
            onPrev={() => setCurrentIndex((prev) => (prev - 1 + links.length) % links.length)}
            onNext={() => setCurrentIndex((prev) => (prev + 1) % links.length)}
            hasPrev={links.length > 1}
            hasNext={links.length > 1}
          />
        ) : (
          <p className="text-camp-wheat/60 text-sm text-center py-2">
            曲がキューにありません
          </p>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-2">
        <span className="text-camp-amber text-xs font-bold uppercase tracking-wider">キュー</span>
        <ul className="flex flex-col gap-2">
          {links.map((link, index) => (
            <li
              key={link.id}
              aria-current={index === currentIndex ? true : undefined}
              className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm ${
                index === currentIndex
                  ? 'bg-camp-orange text-white'
                  : 'bg-camp-warm-white border border-camp-wheat text-camp-dark'
              }`}
            >
              <span className="flex-1 truncate">{link.url}</span>
              {link.added_by_auth_id === currentUserId && (
                <button
                  aria-label="削除"
                  onClick={() => handleDelete(link, index)}
                  disabled={loading}
                  className="text-xs opacity-70 hover:opacity-100 flex-shrink-0"
                >
                  ✕
                </button>
              )}
            </li>
          ))}
        </ul>

        <div className="flex gap-2 mt-1">
          <input
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="YouTube URL"
            className="flex-1 bg-camp-cream border border-camp-wheat rounded-lg px-3 py-2 text-sm text-camp-dark outline-none focus:border-camp-orange"
          />
          <button
            onClick={handleAdd}
            disabled={loading || !url.trim()}
            className="bg-camp-orange text-white text-sm font-bold px-3 py-2 rounded-lg disabled:opacity-40"
          >
            追加
          </button>
        </div>
        {error && <p role="alert" className="text-camp-destructive text-xs">{error}</p>}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: テストが全て通ることを確認**

```bash
npx vitest run src/components/MusicPanel.test.tsx
```

期待: `PASS` 全13件

- [ ] **Step 5: コミット**

```bash
git add src/components/MusicPanel.tsx src/components/MusicPanel.test.tsx
git commit -m "feat: MusicPanel に onMusicAdd prop を追加"
```

---

## Task 3: MainPage にトーストを実装

**Files:**
- Modify: `src/components/MainPage.tsx`
- Test: `src/components/MainPage.test.tsx`

- [ ] **Step 1: MainPage.test.tsx のモックと型インポートを更新**

`src/components/MainPage.test.tsx` の先頭に `Photo` と `MusicLink` のインポートを追加し、`vi.hoisted` と各 `vi.mock` を更新する。

ファイル全体を以下に置き換え：

```tsx
import { render, screen, waitFor, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import MainPage from './MainPage'
import type { Photo, MusicLink } from '../types/session'

const {
  mockNavigate,
  mockEndSession,
  mockRemoveChannel,
  mockGetUser,
  realtimeCallbacks,
  capturedPhotosInsert,
  capturedMusicPanelProps,
} = vi.hoisted(() => ({
  mockNavigate: vi.fn(),
  mockEndSession: vi.fn(),
  mockRemoveChannel: vi.fn(),
  mockGetUser: vi.fn(),
  realtimeCallbacks: { sessionStatus: null as ((payload: { new: { id: string; status: string } }) => void) | null },
  capturedPhotosInsert: { onInsert: undefined as ((photo: Photo) => void) | undefined },
  capturedMusicPanelProps: { onMusicAdd: undefined as ((link: MusicLink) => void) | undefined },
}))

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return { ...actual, useNavigate: () => mockNavigate }
})
vi.mock('../hooks/useSessionEnd', () => ({
  useSessionEnd: () => ({ endSession: mockEndSession, loading: false }),
}))
vi.mock('../hooks/usePhotos', () => ({
  usePhotos: (_sessionId: string, options?: { onInsert?: (photo: Photo) => void }) => {
    capturedPhotosInsert.onInsert = options?.onInsert
    return { photos: [], loading: false, error: null }
  },
}))
vi.mock('../hooks/useParticipants', () => ({
  useParticipants: () => ({
    participants: [
      { id: 'p-1', auth_id: 'uid-alice', name: 'Alice' },
      { id: 'p-2', auth_id: 'uid-bob', name: 'Bob' },
    ],
  }),
}))
vi.mock('qrcode', () => ({
  default: { toDataURL: vi.fn().mockResolvedValue('data:image/png;base64,mock') },
}))
vi.mock('./Slideshow', () => ({
  default: () => <div data-testid="slideshow" />,
}))
vi.mock('./PhotoUpload', () => ({
  default: () => <div data-testid="photo-upload" />,
}))
vi.mock('./MusicPanel', () => ({
  default: ({ onMusicAdd }: { onMusicAdd?: (link: MusicLink) => void }) => {
    capturedMusicPanelProps.onMusicAdd = onMusicAdd
    return <div data-testid="music-panel" />
  },
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
    capturedPhotosInsert.onInsert = undefined
    capturedMusicPanelProps.onMusicAdd = undefined
    vi.spyOn(window, 'confirm').mockReturnValue(true)
  })

  it('写真タブ（デフォルト）でSlideshowが表示される', async () => {
    renderAsHost()
    await waitFor(() => expect(screen.getByTestId('slideshow')).toBeInTheDocument())
  })

  it('参加者数がヘッダーに表示される', async () => {
    renderAsHost()
    await waitFor(() => expect(screen.getByText('👥 2/4')).toBeInTheDocument())
  })

  it('メンバータブに切り替えるとQRコードが表示される', async () => {
    renderAsHost()
    await waitFor(() => screen.getByRole('tab', { name: /メンバー/ }))
    await userEvent.click(screen.getByRole('tab', { name: /メンバー/ }))
    expect(await screen.findByAltText('QR Code')).toBeInTheDocument()
  })

  it('メンバータブに切り替えると参加コードが表示される', async () => {
    renderAsHost()
    await waitFor(() => screen.getByRole('tab', { name: /メンバー/ }))
    await userEvent.click(screen.getByRole('tab', { name: /メンバー/ }))
    expect(await screen.findByText('472819')).toBeInTheDocument()
  })

  it('メンバータブのセッション終了ボタンでendSessionを呼び/へ遷移', async () => {
    mockEndSession.mockResolvedValue(true)
    renderAsHost()
    await waitFor(() => screen.getByRole('tab', { name: /メンバー/ }))
    await userEvent.click(screen.getByRole('tab', { name: /メンバー/ }))
    await userEvent.click(await screen.findByRole('button', { name: 'セッション終了' }))
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
  beforeEach(() => {
    vi.clearAllMocks()
    capturedPhotosInsert.onInsert = undefined
    capturedMusicPanelProps.onMusicAdd = undefined
  })

  it('写真タブにSlideshowが表示されない', async () => {
    renderAsParticipant()
    await waitFor(() => expect(screen.getByTestId('photo-upload')).toBeInTheDocument())
    expect(screen.queryByTestId('slideshow')).not.toBeInTheDocument()
  })

  it('PhotoUploadが表示される', async () => {
    renderAsParticipant()
    await waitFor(() => expect(screen.getByTestId('photo-upload')).toBeInTheDocument())
  })

  it('音楽タブに切り替えるとMusicPanelが表示される', async () => {
    renderAsParticipant()
    await waitFor(() => screen.getByRole('tab', { name: /音楽/ }))
    await userEvent.click(screen.getByRole('tab', { name: /音楽/ }))
    await waitFor(() => expect(screen.getByTestId('music-panel')).toBeInTheDocument())
  })

  it('セッション終了ボタンが存在しない', async () => {
    renderAsParticipant()
    await waitFor(() => expect(screen.getByTestId('photo-upload')).toBeInTheDocument())
    expect(screen.queryByRole('button', { name: 'セッション終了' })).not.toBeInTheDocument()
  })

  it('写真タブ表示中も MusicPanel が DOM に残る', async () => {
    renderAsParticipant()
    await waitFor(() => expect(screen.getByTestId('photo-upload')).toBeInTheDocument())
    expect(screen.getByTestId('music-panel')).toBeInTheDocument()
  })
})

describe('MainPage - トースト', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    capturedPhotosInsert.onInsert = undefined
    capturedMusicPanelProps.onMusicAdd = undefined
  })

  it('写真追加時: 追加者名のトーストが表示される', async () => {
    renderAsParticipant()
    await waitFor(() => expect(screen.getByTestId('photo-upload')).toBeInTheDocument())
    const photo: Photo = {
      id: 'ph-new', session_id: 'sess-1', uploader_auth_id: 'uid-alice',
      storage_path: 'x.jpg', created_at: '',
    }
    act(() => { capturedPhotosInsert.onInsert?.(photo) })
    expect(screen.getByText('📷 Aliceさんが写真を追加しました')).toBeInTheDocument()
  })

  it('音楽追加時: 追加者名のトーストが表示される', async () => {
    renderAsParticipant()
    await waitFor(() => expect(screen.getByTestId('photo-upload')).toBeInTheDocument())
    const link: MusicLink = {
      id: 'ml-new', session_id: 'sess-1', added_by_auth_id: 'uid-bob',
      url: 'https://youtu.be/abc', created_at: '',
    }
    act(() => { capturedMusicPanelProps.onMusicAdd?.(link) })
    expect(screen.getByText('🎵 Bobさんが音楽を追加しました')).toBeInTheDocument()
  })

  it('不明な auth_id の場合は "メンバー" と表示される', async () => {
    renderAsParticipant()
    await waitFor(() => expect(screen.getByTestId('photo-upload')).toBeInTheDocument())
    const photo: Photo = {
      id: 'ph-new', session_id: 'sess-1', uploader_auth_id: 'uid-unknown',
      storage_path: 'x.jpg', created_at: '',
    }
    act(() => { capturedPhotosInsert.onInsert?.(photo) })
    expect(screen.getByText('📷 メンバーさんが写真を追加しました')).toBeInTheDocument()
  })

  it('トーストは3秒後に自動消去される', async () => {
    vi.useFakeTimers()
    renderAsParticipant()
    await waitFor(() => expect(screen.getByTestId('photo-upload')).toBeInTheDocument())
    const photo: Photo = {
      id: 'ph-new', session_id: 'sess-1', uploader_auth_id: 'uid-alice',
      storage_path: 'x.jpg', created_at: '',
    }
    act(() => { capturedPhotosInsert.onInsert?.(photo) })
    expect(screen.getByText('📷 Aliceさんが写真を追加しました')).toBeInTheDocument()
    act(() => { vi.advanceTimersByTime(3000) })
    expect(screen.queryByText('📷 Aliceさんが写真を追加しました')).not.toBeInTheDocument()
    vi.useRealTimers()
  })
})
```

- [ ] **Step 2: テストが失敗することを確認**

```bash
npx vitest run src/components/MainPage.test.tsx
```

期待: `FAIL` — トースト関連4件が失敗（トースト未実装）、既存テストは `PASS`

- [ ] **Step 3: MainPage にトーストを実装**

`src/components/MainPage.tsx` を以下に置き換え：

```tsx
import { useState, useEffect, useRef } from 'react'
import { useNavigate, useLocation, useParams } from 'react-router-dom'
import QRCode from 'qrcode'
import Slideshow from './Slideshow'
import PhotoUpload from './PhotoUpload'
import MusicPanel from './MusicPanel'
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs'
import { useSessionEnd } from '../hooks/useSessionEnd'
import { usePhotos } from '../hooks/usePhotos'
import { useParticipants } from '../hooks/useParticipants'
import { supabase } from '../lib/supabase'
import type { Session, Photo, MusicLink } from '../types/session'

export default function MainPage() {
  const { sessionId } = useParams<{ sessionId: string }>()
  const location = useLocation()
  const session = location.state?.session as Session
  const navigate = useNavigate()
  const { endSession, loading } = useSessionEnd()
  const [isHost, setIsHost] = useState(false)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const { participants } = useParticipants(sessionId ?? '')
  const [qrUrl, setQrUrl] = useState('')
  const [qrError, setQrError] = useState(false)
  const [toast, setToast] = useState<{ message: string; id: number } | null>(null)
  const toastIdRef = useRef(0)

  const MAX_PARTICIPANTS = 4

  const resolveName = (authId: string) =>
    participants.find((p) => p.auth_id === authId)?.name ?? 'メンバー'

  const showToast = (message: string) => {
    const id = ++toastIdRef.current
    setToast({ message, id })
  }

  const { photos } = usePhotos(sessionId!, {
    onInsert: (photo: Photo) =>
      showToast(`📷 ${resolveName(photo.uploader_auth_id)}さんが写真を追加しました`),
  })

  const handleMusicAdd = (link: MusicLink) =>
    showToast(`🎵 ${resolveName(link.added_by_auth_id)}さんが音楽を追加しました`)

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 3000)
    return () => clearTimeout(t)
  }, [toast?.id])

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user }, error }) => {
      if (error || !user) return
      setCurrentUserId(user.id)
      setIsHost(session?.host_auth_id === user.id)
    })
  }, [session])

  useEffect(() => {
    if (!session?.code) return
    const joinUrl = `${window.location.origin}/join/${session.code}`
    QRCode.toDataURL(joinUrl).then(setQrUrl).catch(() => setQrError(true))
  }, [session?.code])

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

  const tabTriggerClass =
    'flex-1 flex flex-col gap-0.5 py-2 text-xs rounded-none bg-transparent ' +
    'text-camp-cream/60 data-[state=active]:text-camp-cream ' +
    'data-[state=active]:border-t-2 data-[state=active]:border-camp-orange ' +
    'data-[state=active]:bg-transparent data-[state=active]:shadow-none'

  return (
    <div className="flex flex-col h-screen bg-camp-cream">
      <header className="bg-camp-brown px-4 py-3 flex items-center justify-between flex-shrink-0">
        <span className="text-camp-cream font-bold text-sm">🏕 CampCanvas</span>
        <span className="text-camp-cream text-xs opacity-80">
          👥 {participants.length}/{MAX_PARTICIPANTS}
        </span>
      </header>

      {toast && (
        <div className="bg-camp-brown/90 text-camp-cream text-sm px-4 py-2 text-center flex-shrink-0">
          {toast.message}
        </div>
      )}

      <Tabs defaultValue="photo" className="flex flex-col flex-1 overflow-hidden">
        <TabsContent value="photo" className="flex-1 overflow-y-auto p-4 space-y-4 mt-0">
          {isHost && <Slideshow photos={photos} />}
          {currentUserId && (
            <PhotoUpload
              sessionId={sessionId!}
              photos={photos}
              currentUserId={currentUserId}
            />
          )}
        </TabsContent>

        <TabsContent value="music" forceMount className="flex-1 overflow-y-auto mt-0 data-[state=inactive]:hidden">
          {currentUserId && (
            <MusicPanel
              sessionId={sessionId!}
              currentUserId={currentUserId}
              onMusicAdd={handleMusicAdd}
            />
          )}
        </TabsContent>

        <TabsContent value="member" className="flex-1 overflow-y-auto p-4 space-y-4 mt-0">
          <p className="text-center text-camp-amber text-sm font-medium">
            {participants.length} / {MAX_PARTICIPANTS} 人参加中
          </p>
          {isHost && (
            <>
              <div className="bg-camp-warm-white border border-camp-wheat rounded-xl p-4 flex flex-col items-center gap-3">
                {qrUrl ? (
                  <img src={qrUrl} alt="QR Code" className="w-32 h-32" />
                ) : qrError ? (
                  <p className="text-camp-destructive text-xs">QR生成に失敗</p>
                ) : null}
                <span className="bg-camp-wheat text-camp-brown font-bold tracking-widest px-4 py-1 rounded-md text-sm">
                  {session?.code}
                </span>
              </div>
              <button
                onClick={handleEnd}
                disabled={loading}
                className="w-full border-2 border-camp-destructive text-camp-destructive font-bold py-3 rounded-xl bg-transparent"
              >
                セッション終了
              </button>
            </>
          )}
        </TabsContent>

        <TabsList className="flex-shrink-0 bg-camp-brown w-full rounded-none h-auto py-0 justify-around">
          <TabsTrigger value="photo" className={tabTriggerClass}>
            <span>📸</span><span>写真</span>
          </TabsTrigger>
          <TabsTrigger value="music" className={tabTriggerClass}>
            <span>🎵</span><span>音楽</span>
          </TabsTrigger>
          <TabsTrigger value="member" className={tabTriggerClass}>
            <span>👥</span><span>メンバー</span>
          </TabsTrigger>
        </TabsList>
      </Tabs>
    </div>
  )
}
```

- [ ] **Step 4: 全テストが通ることを確認**

```bash
npx vitest run src/components/MainPage.test.tsx
```

期待: `PASS` 全16件（既存12件 + トースト4件）

- [ ] **Step 5: 全体テストが壊れていないことを確認**

```bash
npx vitest run
```

期待: 全テスト `PASS`

- [ ] **Step 6: コミット**

```bash
git add src/components/MainPage.tsx src/components/MainPage.test.tsx
git commit -m "feat: 写真・音楽追加者通知トーストを実装"
```
