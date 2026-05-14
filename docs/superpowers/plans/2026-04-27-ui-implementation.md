# CampCanvas UI 実装計画

> **Codex 向け:** この計画は現在のセッションでタスクごとに実装してください。サブエージェントは、ユーザーが委任または並列作業を明示的に依頼し、かつアクティブな Codex 実行環境が許可している場合にのみ使用します。手順は追跡用にチェックボックス（`- [ ]`）形式を使用します。

**Goal:** Tailwind CSS + shadcn/ui でウォームキャンプテーマの全画面UIを実装し、MainPage をタブナビゲーション構造にリファクタリングする

**Architecture:** Tailwind v4 + shadcn/ui コンポーネントを使用。カスタムカラーパレット（`camp-*`）を `@theme` で定義し全コンポーネントに適用。MainPage は Radix UI ベースの shadcn Tabs で写真/音楽/メンバータブに再構成し、JoinOverlay を廃止。

**Tech Stack:** Tailwind CSS v4, @tailwindcss/vite, shadcn/ui (Tabs/Button/Input/Card/Badge), clsx, tailwind-merge

---

## ファイル変更一覧

| ファイル | 操作 |
|---|---|
| `vite.config.ts` | Modify: tailwindcss プラグイン + path alias 追加 |
| `tsconfig.app.json` | Modify: baseUrl + paths (@/ alias) 追加 |
| `src/index.css` | Modify: @import tailwindcss + @theme カラートークン |
| `components.json` | Create: shadcn 設定ファイル |
| `src/lib/utils.ts` | Create: shadcn cn ユーティリティ |
| `src/components/ui/tabs.tsx` | Create: shadcn Tabs コンポーネント |
| `src/components/ui/button.tsx` | Create: shadcn Button コンポーネント |
| `src/components/ui/input.tsx` | Create: shadcn Input コンポーネント |
| `src/components/ui/card.tsx` | Create: shadcn Card コンポーネント |
| `src/components/ui/badge.tsx` | Create: shadcn Badge コンポーネント |
| `src/components/MainPage.tsx` | Modify: Tabs 構造 + QR/メンバータブ統合 |
| `src/components/MainPage.test.tsx` | Modify: JoinOverlay テスト削除 + タブテスト追加 |
| `src/components/JoinOverlay.tsx` | Delete |
| `src/components/JoinOverlay.test.tsx` | Delete |
| `src/components/TopPage.tsx` | Modify: Tailwind スタイル追加 |
| `src/components/SessionCreate.tsx` | Modify: Tailwind スタイル追加 |
| `src/components/SessionJoin.tsx` | Modify: Tailwind スタイル追加 |
| `src/components/InviteScreen.tsx` | Modify: Tailwind スタイル追加 |
| `src/components/Slideshow.tsx` | Modify: Tailwind スタイル追加 |
| `src/components/PhotoUpload.tsx` | Modify: Tailwind スタイル追加 |
| `src/components/MusicPanel.tsx` | Modify: Tailwind スタイル追加 |

---

## Task 1: Tailwind v4 + shadcn/ui セットアップ

**Files:**
- Modify: `vite.config.ts`
- Modify: `tsconfig.app.json`
- Modify: `src/index.css`
- Create: `components.json`
- Create: `src/lib/utils.ts`

- [ ] **Step 1: パッケージインストール**

```bash
npm install tailwindcss @tailwindcss/vite clsx tailwind-merge lucide-react
```

- [ ] **Step 2: vite.config.ts を更新**

```ts
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig({
  plugins: [tailwindcss(), react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    globals: true,
    passWithNoTests: true,
  },
})
```

- [ ] **Step 3: tsconfig.app.json に path alias 追加**

`compilerOptions` に以下を追記（既存の末尾に追加）:

```json
"baseUrl": ".",
"paths": {
  "@/*": ["./src/*"]
}
```

完成後の `compilerOptions` 末尾:

```json
    "types": ["vitest/globals", "vite/client"],
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    }
```

- [ ] **Step 4: src/index.css を置き換え**

```css
@import "tailwindcss";

@theme {
  --color-camp-orange: #e07b39;
  --color-camp-brown: #7c4a1e;
  --color-camp-amber: #c8954a;
  --color-camp-cream: #fdf6ec;
  --color-camp-warm-white: #fff8f0;
  --color-camp-wheat: #f0c896;
  --color-camp-dark: #3d2003;
  --color-camp-destructive: #c0392b;
}

body {
  margin: 0;
  min-height: 100dvh;
}
```

- [ ] **Step 5: components.json を作成**

プロジェクトルート `/c/ws/playerApp/components.json`:

```json
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "default",
  "rsc": false,
  "tsx": true,
  "tailwind": {
    "config": "",
    "css": "src/index.css",
    "baseColor": "stone",
    "cssVariables": true,
    "prefix": ""
  },
  "aliases": {
    "components": "@/components",
    "utils": "@/lib/utils",
    "ui": "@/components/ui",
    "lib": "@/lib",
    "hooks": "@/hooks"
  },
  "iconLibrary": "lucide"
}
```

- [ ] **Step 6: src/lib/utils.ts を作成**

```ts
import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
```

- [ ] **Step 7: shadcn コンポーネントを追加**

```bash
npx shadcn@latest add button input card tabs badge
```

完了後、以下のファイルが生成されていることを確認:
- `src/components/ui/button.tsx`
- `src/components/ui/input.tsx`
- `src/components/ui/card.tsx`
- `src/components/ui/tabs.tsx`
- `src/components/ui/badge.tsx`

- [ ] **Step 8: ビルド確認**

```bash
npm run build 2>&1 | tail -5
```

期待出力: `✓ built in` が含まれること。エラーがないこと。

- [ ] **Step 9: テスト確認（全パス）**

```bash
npm test -- --run 2>&1 | tail -10
```

期待出力: `Tests X passed` (全テストパス)

- [ ] **Step 10: コミット**

```bash
git add vite.config.ts tsconfig.app.json src/index.css components.json src/lib/utils.ts src/components/ui/
git commit -m "feat: set up Tailwind v4 + shadcn/ui with camp color theme"
```

---

## Task 2: MainPage リファクタリング（タブ構造 + JoinOverlay 廃止）

**Files:**
- Modify: `src/components/MainPage.test.tsx`
- Modify: `src/components/MainPage.tsx`
- Delete: `src/components/JoinOverlay.tsx`
- Delete: `src/components/JoinOverlay.test.tsx`

- [ ] **Step 1: MainPage.test.tsx を新しいタブ構造に合わせて書き換え**

`src/components/MainPage.test.tsx` を以下で置き換える:

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
vi.mock('../hooks/useParticipants', () => ({
  useParticipants: () => ({ participants: [{ id: 'p-1' }, { id: 'p-2' }] }),
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
  beforeEach(() => { vi.clearAllMocks() })

  it('写真タブにSlideshowが表示されない', async () => {
    renderAsParticipant()
    await waitFor(() => expect(screen.getByTestId('photo-upload')).toBeInTheDocument())
    expect(screen.queryByTestId('slideshow')).not.toBeInTheDocument()
  })

  it('PhotoUploadが表示される', async () => {
    renderAsParticipant()
    await waitFor(() => expect(screen.getByTestId('photo-upload')).toBeInTheDocument())
  })

  it('MusicPanelが表示される', async () => {
    renderAsParticipant()
    await waitFor(() => expect(screen.getByTestId('music-panel')).toBeInTheDocument())
  })

  it('セッション終了ボタンが存在しない', async () => {
    renderAsParticipant()
    await waitFor(() => expect(screen.getByTestId('photo-upload')).toBeInTheDocument())
    expect(screen.queryByRole('button', { name: 'セッション終了' })).not.toBeInTheDocument()
  })
})
```

- [ ] **Step 2: テストが失敗することを確認**

```bash
npm test -- --run src/components/MainPage.test.tsx 2>&1 | tail -20
```

期待: 複数テストが FAIL すること（JoinOverlay mock が残っているため）

- [ ] **Step 3: MainPage.tsx を新しいタブ構造に書き換え**

```tsx
import { useState, useEffect } from 'react'
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
import type { Session } from '../types/session'

export default function MainPage() {
  const { sessionId } = useParams<{ sessionId: string }>()
  const location = useLocation()
  const session = location.state?.session as Session
  const navigate = useNavigate()
  const { endSession, loading } = useSessionEnd()
  const [isHost, setIsHost] = useState(false)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const { photos } = usePhotos(sessionId!)
  const { participants } = useParticipants(sessionId ?? '')
  const [qrUrl, setQrUrl] = useState('')

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
    QRCode.toDataURL(joinUrl).then(setQrUrl).catch(console.error)
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
          👥 {participants.length}/4
        </span>
      </header>

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

        <TabsContent value="music" className="flex-1 overflow-y-auto mt-0">
          {currentUserId && (
            <MusicPanel sessionId={sessionId!} currentUserId={currentUserId} />
          )}
        </TabsContent>

        <TabsContent value="member" className="flex-1 overflow-y-auto p-4 space-y-4 mt-0">
          <p className="text-center text-camp-amber text-sm font-medium">
            {participants.length} / 4 人参加中
          </p>
          {isHost && (
            <>
              {qrUrl && (
                <div className="bg-camp-warm-white border border-camp-wheat rounded-xl p-4 flex flex-col items-center gap-3">
                  <img src={qrUrl} alt="QR Code" className="w-32 h-32" />
                  <span className="bg-camp-wheat text-camp-brown font-bold tracking-widest px-4 py-1 rounded-md text-sm">
                    {session?.code}
                  </span>
                </div>
              )}
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

- [ ] **Step 4: テストが通ることを確認**

```bash
npm test -- --run src/components/MainPage.test.tsx 2>&1 | tail -15
```

期待: `Tests X passed`

- [ ] **Step 5: JoinOverlay.tsx と JoinOverlay.test.tsx を削除**

```bash
rm src/components/JoinOverlay.tsx src/components/JoinOverlay.test.tsx
```

- [ ] **Step 6: 全テスト確認**

```bash
npm test -- --run 2>&1 | tail -10
```

期待: 全テストパス（JoinOverlay.test.tsx が消えてテスト数は減る）

- [ ] **Step 7: コミット**

```bash
git add -A
git commit -m "feat: refactor MainPage to tab navigation, remove JoinOverlay"
```

---

## Task 3: TopPage スタイリング

**Files:**
- Modify: `src/components/TopPage.tsx`

- [ ] **Step 1: 既存テストのパス確認**

```bash
npm test -- --run src/components/TopPage.test.tsx 2>&1 | tail -5
```

期待: `Tests 4 passed`

- [ ] **Step 2: TopPage.tsx を置き換え**

```tsx
import { useNavigate } from 'react-router-dom'

export default function TopPage() {
  const navigate = useNavigate()
  return (
    <div className="flex flex-col min-h-screen bg-camp-cream">
      <header className="bg-camp-brown py-10 flex flex-col items-center gap-2">
        <span className="text-5xl">🏕</span>
        <h1 className="text-camp-cream font-bold text-2xl tracking-wide">CampCanvas</h1>
        <p className="text-camp-cream/70 text-sm">思い出を、みんなで。</p>
      </header>
      <main className="flex flex-col items-center justify-center flex-1 gap-4 px-6">
        <button
          onClick={() => navigate('/create')}
          className="w-full max-w-sm bg-camp-orange text-white font-bold text-base py-3 rounded-xl shadow-sm"
        >
          セッション開始
        </button>
        <button
          onClick={() => navigate('/join')}
          className="w-full max-w-sm bg-camp-warm-white text-camp-orange font-bold text-base py-3 rounded-xl border-2 border-camp-orange"
        >
          セッションに参加
        </button>
      </main>
    </div>
  )
}
```

- [ ] **Step 3: テスト確認**

```bash
npm test -- --run src/components/TopPage.test.tsx 2>&1 | tail -5
```

期待: `Tests 4 passed`

- [ ] **Step 4: コミット**

```bash
git add src/components/TopPage.tsx
git commit -m "style: apply warm camp theme to TopPage"
```

---

## Task 4: SessionCreate スタイリング

**Files:**
- Modify: `src/components/SessionCreate.tsx`

- [ ] **Step 1: 既存テストのパス確認**

```bash
npm test -- --run src/components/SessionCreate.test.tsx 2>&1 | tail -5
```

- [ ] **Step 2: SessionCreate.tsx を置き換え**

```tsx
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
    <div className="flex flex-col min-h-screen bg-camp-cream">
      <header className="bg-camp-brown px-4 py-3 flex items-center">
        <button
          onClick={() => navigate(-1)}
          className="text-camp-cream text-sm font-medium"
        >
          ← 戻る
        </button>
        <h2 className="text-camp-cream font-bold text-sm mx-auto">セッション作成</h2>
      </header>
      <main className="flex flex-col items-center justify-center flex-1 px-6">
        <form
          onSubmit={handleSubmit}
          className="w-full max-w-sm bg-camp-warm-white border border-camp-wheat rounded-2xl p-6 flex flex-col gap-4"
        >
          <label className="flex flex-col gap-1.5">
            <span className="text-camp-brown text-sm font-semibold">ニックネーム</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="例）たろう"
              className="bg-camp-cream border border-camp-wheat rounded-lg px-3 py-2.5 text-camp-dark text-sm placeholder:text-camp-wheat/80 outline-none focus:border-camp-orange"
            />
          </label>
          {error && <p role="alert" className="text-camp-destructive text-xs">{error}</p>}
          <button
            type="submit"
            disabled={loading || !name.trim()}
            className="bg-camp-orange text-white font-bold py-3 rounded-xl disabled:opacity-40"
          >
            {loading ? '作成中...' : 'セッションを作成'}
          </button>
        </form>
      </main>
    </div>
  )
}
```

- [ ] **Step 3: テスト確認**

```bash
npm test -- --run src/components/SessionCreate.test.tsx 2>&1 | tail -5
```

- [ ] **Step 4: コミット**

```bash
git add src/components/SessionCreate.tsx
git commit -m "style: apply warm camp theme to SessionCreate"
```

---

## Task 5: SessionJoin スタイリング

**Files:**
- Modify: `src/components/SessionJoin.tsx`

- [ ] **Step 1: 既存テストのパス確認**

```bash
npm test -- --run src/components/SessionJoin.test.tsx 2>&1 | tail -5
```

- [ ] **Step 2: SessionJoin.tsx を置き換え**

```tsx
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
    <div className="flex flex-col min-h-screen bg-camp-cream">
      <header className="bg-camp-brown px-4 py-3 flex items-center">
        <button
          onClick={() => navigate(-1)}
          className="text-camp-cream text-sm font-medium"
        >
          ← 戻る
        </button>
        <h2 className="text-camp-cream font-bold text-sm mx-auto">セッション参加</h2>
      </header>
      <main className="flex flex-col items-center justify-center flex-1 px-6">
        <form
          onSubmit={handleSubmit}
          className="w-full max-w-sm bg-camp-warm-white border border-camp-wheat rounded-2xl p-6 flex flex-col gap-4"
        >
          <label className="flex flex-col gap-1.5">
            <span className="text-camp-brown text-sm font-semibold">6桁コード</span>
            <input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="ABC123"
              maxLength={6}
              className="bg-camp-cream border border-camp-wheat rounded-lg px-3 py-2.5 text-camp-dark text-sm tracking-widest placeholder:text-camp-wheat/80 outline-none focus:border-camp-orange uppercase"
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-camp-brown text-sm font-semibold">ニックネーム</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="例）はなこ"
              className="bg-camp-cream border border-camp-wheat rounded-lg px-3 py-2.5 text-camp-dark text-sm placeholder:text-camp-wheat/80 outline-none focus:border-camp-orange"
            />
          </label>
          {error && <p role="alert" className="text-camp-destructive text-xs">{error}</p>}
          <button
            type="submit"
            disabled={!code.trim() || !name.trim() || loading}
            className="bg-camp-orange text-white font-bold py-3 rounded-xl disabled:opacity-40"
          >
            参加する
          </button>
        </form>
      </main>
    </div>
  )
}
```

- [ ] **Step 3: テスト確認**

```bash
npm test -- --run src/components/SessionJoin.test.tsx 2>&1 | tail -5
```

- [ ] **Step 4: コミット**

```bash
git add src/components/SessionJoin.tsx
git commit -m "style: apply warm camp theme to SessionJoin"
```

---

## Task 6: InviteScreen スタイリング

**Files:**
- Modify: `src/components/InviteScreen.tsx`

- [ ] **Step 1: 既存テストのパス確認**

```bash
npm test -- --run src/components/InviteScreen.test.tsx 2>&1 | tail -5
```

- [ ] **Step 2: InviteScreen.tsx を置き換え**

```tsx
import { useEffect, useState } from 'react'
import { useNavigate, useParams, useLocation } from 'react-router-dom'
import QRCode from 'qrcode'
import { useParticipants } from '../hooks/useParticipants'
import type { Session } from '../types/session'

export default function InviteScreen() {
  const { sessionId } = useParams<{ sessionId: string }>()
  const location = useLocation()
  const session = location.state?.session as Session | undefined
  const navigate = useNavigate()
  const [qrUrl, setQrUrl] = useState('')
  const { participants } = useParticipants(sessionId ?? '')

  const joinUrl = `${window.location.origin}/join/${session?.code}`

  useEffect(() => {
    if (session?.code) {
      QRCode.toDataURL(joinUrl).then(setQrUrl).catch(console.error)
    }
  }, [joinUrl])

  if (!sessionId) return null

  return (
    <div className="flex flex-col min-h-screen bg-camp-cream">
      <header className="bg-camp-brown px-4 py-3 flex items-center justify-center">
        <h2 className="text-camp-cream font-bold text-sm">メンバーを招待</h2>
      </header>
      <main className="flex flex-col items-center justify-center flex-1 gap-5 px-6">
        <div className="bg-camp-warm-white border border-camp-wheat rounded-2xl p-6 flex flex-col items-center gap-4 w-full max-w-xs">
          {qrUrl && (
            <img src={qrUrl} alt="QR Code" className="w-36 h-36 rounded-lg" />
          )}
          <span className="bg-camp-wheat text-camp-brown font-bold tracking-widest px-6 py-1.5 rounded-lg text-lg">
            {session?.code}
          </span>
          <p className="text-camp-amber text-sm font-medium">
            {participants.length} / 4 人参加中
          </p>
        </div>
        <button
          onClick={() => navigate(`/session/${sessionId}`, { state: { session } })}
          className="w-full max-w-xs bg-camp-orange text-white font-bold py-3 rounded-xl shadow-sm"
        >
          スタート
        </button>
      </main>
    </div>
  )
}
```

- [ ] **Step 3: テスト確認**

```bash
npm test -- --run src/components/InviteScreen.test.tsx 2>&1 | tail -5
```

- [ ] **Step 4: コミット**

```bash
git add src/components/InviteScreen.tsx
git commit -m "style: apply warm camp theme to InviteScreen"
```

---

## Task 7: Slideshow スタイリング

**Files:**
- Modify: `src/components/Slideshow.tsx`

- [ ] **Step 1: 既存テストのパス確認**

```bash
npm test -- --run src/components/Slideshow.test.tsx 2>&1 | tail -5
```

- [ ] **Step 2: Slideshow.tsx を置き換え**

```tsx
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
    return (
      <div
        aria-label="スライドショー"
        className="w-full aspect-video bg-camp-wheat/40 rounded-xl flex items-center justify-center text-camp-amber text-sm"
      >
        写真がまだありません
      </div>
    )
  }

  const safeIndex = currentIndex % photos.length
  const photo = photos[safeIndex]
  const { data: { publicUrl } } = supabase.storage.from('photos').getPublicUrl(photo.storage_path)

  return (
    <div aria-label="スライドショー" className="relative w-full aspect-video rounded-xl overflow-hidden bg-camp-wheat/40">
      <img
        src={publicUrl}
        alt={`スライド ${safeIndex + 1}`}
        className="w-full h-full object-cover"
      />
      <span className="absolute bottom-2 right-2 bg-camp-dark/60 text-camp-cream text-xs px-2 py-0.5 rounded-full">
        {safeIndex + 1} / {photos.length}
      </span>
    </div>
  )
}
```

- [ ] **Step 3: テスト確認**

```bash
npm test -- --run src/components/Slideshow.test.tsx 2>&1 | tail -5
```

- [ ] **Step 4: コミット**

```bash
git add src/components/Slideshow.tsx
git commit -m "style: apply warm camp theme to Slideshow"
```

---

## Task 8: PhotoUpload スタイリング

**Files:**
- Modify: `src/components/PhotoUpload.tsx`

- [ ] **Step 1: 既存テストのパス確認**

```bash
npm test -- --run src/components/PhotoUpload.test.tsx 2>&1 | tail -5
```

- [ ] **Step 2: PhotoUpload.tsx を置き換え**

```tsx
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
    <div className="flex flex-col gap-3">
      <label className="flex items-center justify-center gap-2 bg-camp-orange text-white font-bold py-2.5 rounded-xl cursor-pointer">
        📷 写真を追加
        <input
          type="file"
          accept="image/*"
          aria-label="写真を追加"
          onChange={handleFileChange}
          disabled={loading}
          className="hidden"
        />
      </label>
      {error && <p role="alert" className="text-camp-destructive text-xs">{error}</p>}
      {myPhotos.length > 0 && (
        <ul className="grid grid-cols-3 gap-2">
          {myPhotos.map((photo) => {
            const { data: { publicUrl } } = supabase.storage.from('photos').getPublicUrl(photo.storage_path)
            return (
              <li key={photo.id} className="relative aspect-square">
                <img
                  src={publicUrl}
                  alt="アップロード済み写真"
                  className="w-full h-full object-cover rounded-lg"
                />
                <button
                  aria-label="削除"
                  onClick={() => deletePhoto(photo.id, photo.storage_path)}
                  disabled={loading}
                  className="absolute top-1 right-1 bg-camp-dark/70 text-camp-cream text-xs w-5 h-5 rounded-full flex items-center justify-center"
                >
                  ✕
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

- [ ] **Step 3: テスト確認**

```bash
npm test -- --run src/components/PhotoUpload.test.tsx 2>&1 | tail -5
```

- [ ] **Step 4: コミット**

```bash
git add src/components/PhotoUpload.tsx
git commit -m "style: apply warm camp theme to PhotoUpload"
```

---

## Task 9: MusicPanel スタイリング

**Files:**
- Modify: `src/components/MusicPanel.tsx`

- [ ] **Step 1: 既存テストのパス確認**

```bash
npm test -- --run src/components/MusicPanel.test.tsx 2>&1 | tail -5
```

- [ ] **Step 2: MusicPanel.tsx を置き換え**

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
}

export default function MusicPanel({ sessionId, currentUserId }: Props) {
  const { links } = useMusicLinks(sessionId)
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

  const handleEnded = () => {
    setCurrentIndex((prev) => (prev + 1) % links.length)
    setRestartKey((k) => k + 1)
  }

  const currentLink = links[currentIndex]
  const videoId = currentLink ? extractYouTubeId(currentLink.url) : null

  return (
    <div className="flex flex-col h-full">
      {/* Player area */}
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

      {/* Queue */}
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

        {/* Add URL */}
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

- [ ] **Step 3: テスト確認**

```bash
npm test -- --run src/components/MusicPanel.test.tsx 2>&1 | tail -5
```

- [ ] **Step 4: 全テスト最終確認**

```bash
npm test -- --run 2>&1 | tail -10
```

期待: 全テストパス

- [ ] **Step 5: コミット**

```bash
git add src/components/MusicPanel.tsx
git commit -m "style: apply warm camp theme to MusicPanel"
```
