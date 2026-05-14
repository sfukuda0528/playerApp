# UI リデザイン（ウォームモダン + FontAwesome）実装計画

> **Codex 向け:** この計画は現在のセッションでタスクごとに実装してください。サブエージェントは、ユーザーが委任または並列作業を明示的に依頼し、かつアクティブな Codex 実行環境が許可している場合にのみ使用します。手順は追跡用にチェックボックス（`- [ ]`）形式を使用します。

**Goal:** 全画面をグラデーション・カード影・タップアニメ・FontAwesome アイコンでリッチ化する

**Architecture:** 既存コンポーネントのみ変更（新ファイル不要）。ロジック・hooks・型定義はそのまま。FontAwesome を React コンポーネントとして使用。グラデーション値は inline style で記述（複雑なため）。

**Tech Stack:** React, TypeScript, Tailwind CSS v4, @fortawesome/react-fontawesome, @fortawesome/free-solid-svg-icons, @fortawesome/free-brands-svg-icons

---

## ファイル変更一覧

| ファイル | 変更種別 |
|---|---|
| `package.json` | FontAwesome 4パッケージ追加 |
| `src/index.css` | keyframes 2件 + `--animate-slide-down` テーマ変数追加 |
| `src/components/TopPage.tsx` | グラデーション・FAアイコン |
| `src/components/SessionCreate.tsx` | グラデーション・FAアイコン |
| `src/components/SessionJoin.tsx` | グラデーション・FAアイコン |
| `src/components/InviteScreen.tsx` | グラデーション・カード影・FAアイコン |
| `src/components/YouTubePlayer.tsx` | コントロール UI + FAアイコン |
| `src/components/MainPage.tsx` | ヘッダー・タブ・トースト・メンバーリスト |
| `src/components/MainPage.test.tsx` | 絵文字テキスト検索 → FA 対応に更新 |
| `src/components/MusicPanel.tsx` | プレイヤー・キュー・検索 UI |

---

## Task 1: FontAwesome パッケージインストール

**Files:**
- Modify: `package.json` (npm install で自動更新)

- [ ] **Step 1: パッケージインストール**

```bash
cd C:/ws/playerApp
npm install @fortawesome/fontawesome-svg-core @fortawesome/free-solid-svg-icons @fortawesome/free-brands-svg-icons @fortawesome/react-fontawesome
```

- [ ] **Step 2: インポート確認**

```bash
node -e "const { faCampground } = require('@fortawesome/free-solid-svg-icons'); console.log(faCampground.iconName)"
```

期待出力: `campground`

- [ ] **Step 3: コミット**

```bash
git add package.json package-lock.json
git commit -m "chore: FontAwesome パッケージを追加"
```

---

## Task 2: index.css — keyframes & animation ユーティリティ

**Files:**
- Modify: `src/index.css`

- [ ] **Step 1: `src/index.css` を以下に置き換え**

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
  --animate-slide-down: slide-down 300ms ease-out both;
}

@keyframes slide-down {
  from { transform: translateY(-100%); opacity: 0; }
  to   { transform: translateY(0);     opacity: 1; }
}

@keyframes pulse-glow {
  0%, 100% { box-shadow: 0 0 0 0 rgba(224, 123, 57, 0); }
  50%       { box-shadow: 0 0 0 4px rgba(224, 123, 57, 0.25); }
}

body {
  margin: 0;
  min-height: 100dvh;
}
```

- [ ] **Step 2: 開発サーバーでコンパイルエラーなしを確認**

```bash
npm run build 2>&1 | tail -5
```

期待: エラーなし（`✓ built in ...` 等）

- [ ] **Step 3: コミット**

```bash
git add src/index.css
git commit -m "style: slide-down / pulse-glow keyframes を index.css に追加"
```

---

## Task 3: TopPage.tsx

**Files:**
- Modify: `src/components/TopPage.tsx`

- [ ] **Step 1: テストがパスすることを確認（変更前ベースライン）**

```bash
npm test -- --reporter=verbose TopPage 2>&1 | tail -20
```

- [ ] **Step 2: `src/components/TopPage.tsx` を以下に置き換え**

```tsx
import { useNavigate } from 'react-router-dom'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faCampground, faPlay, faRightToBracket } from '@fortawesome/free-solid-svg-icons'

export default function TopPage() {
  const navigate = useNavigate()
  return (
    <div className="flex flex-col min-h-screen" style={{ background: 'linear-gradient(170deg, #fdf6ec, #fff8f0)' }}>
      <header
        className="py-10 flex flex-col items-center gap-2 relative overflow-hidden"
        style={{ background: 'linear-gradient(160deg, #5a2800 0%, #7c4a1e 55%, #b06228 100%)' }}
      >
        <div
          className="absolute inset-0"
          style={{ background: 'radial-gradient(ellipse at 50% 110%, rgba(224,123,57,0.35), transparent 65%)' }}
        />
        <FontAwesomeIcon
          icon={faCampground}
          className="text-5xl text-camp-cream relative z-10"
          style={{ filter: 'drop-shadow(0 2px 8px rgba(224,123,57,0.6))' }}
        />
        <h1 className="text-camp-cream font-bold text-2xl tracking-widest relative z-10">CampCanvas</h1>
        <p className="text-camp-cream/60 text-sm relative z-10">思い出を、みんなで。</p>
      </header>
      <main className="flex flex-col items-center justify-center flex-1 gap-3 px-6">
        <button
          onClick={() => navigate('/create')}
          className="w-full max-w-sm text-white font-bold text-base py-3.5 rounded-2xl active:scale-95 transition-all duration-150 flex items-center justify-center gap-2"
          style={{
            background: 'linear-gradient(135deg, #e07b39, #c8601a)',
            boxShadow: '0 6px 18px rgba(224,123,57,0.45), 0 2px 4px rgba(200,96,26,0.3)',
          }}
        >
          <FontAwesomeIcon icon={faPlay} />
          セッション開始
        </button>
        <button
          onClick={() => navigate('/join')}
          className="w-full max-w-sm text-camp-orange font-bold text-base py-3.5 rounded-2xl border-2 border-camp-orange active:scale-95 transition-all duration-150 flex items-center justify-center gap-2"
          style={{
            background: 'linear-gradient(135deg, #fff8f0, white)',
            boxShadow: '0 4px 12px rgba(224,123,57,0.15)',
          }}
        >
          <FontAwesomeIcon icon={faRightToBracket} />
          セッションに参加
        </button>
      </main>
    </div>
  )
}
```

- [ ] **Step 3: テストがパスすることを確認**

```bash
npm test -- --reporter=verbose TopPage 2>&1 | tail -20
```

期待: PASS（ボタンラベル・ナビゲーションのテストはロジック変更なし）

- [ ] **Step 4: コミット**

```bash
git add src/components/TopPage.tsx
git commit -m "style: TopPage グラデーションヘッダー・FontAwesome アイコン適用"
```

---

## Task 4: SessionCreate.tsx

**Files:**
- Modify: `src/components/SessionCreate.tsx`

- [ ] **Step 1: テストがパスすることを確認**

```bash
npm test -- --reporter=verbose SessionCreate 2>&1 | tail -20
```

- [ ] **Step 2: `src/components/SessionCreate.tsx` を以下に置き換え**

```tsx
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faChevronLeft, faUser, faCampground } from '@fortawesome/free-solid-svg-icons'
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
    <div className="flex flex-col min-h-screen" style={{ background: 'linear-gradient(170deg, #fdf6ec, #fff8f0)' }}>
      <header
        className="px-4 py-3 flex items-center"
        style={{ background: 'linear-gradient(135deg, #5a2800, #7c4a1e, #b06228)' }}
      >
        <button
          onClick={() => navigate(-1)}
          className="text-camp-cream/70 text-sm font-medium flex items-center gap-1 active:scale-95 transition-all duration-150"
        >
          <FontAwesomeIcon icon={faChevronLeft} className="text-xs" />
          戻る
        </button>
        <h2 className="text-camp-cream font-bold text-sm mx-auto">セッション作成</h2>
      </header>
      <main className="flex flex-col items-center justify-center flex-1 px-6">
        <form
          onSubmit={handleSubmit}
          className="w-full max-w-sm bg-white rounded-[18px] p-6 flex flex-col gap-4"
          style={{ boxShadow: '0 6px 24px rgba(124,74,30,0.14)', border: '1px solid rgba(240,200,150,0.4)' }}
        >
          <label className="flex flex-col gap-1.5">
            <span className="text-camp-brown text-sm font-semibold tracking-wide flex items-center gap-1.5">
              <FontAwesomeIcon icon={faUser} className="text-camp-amber text-xs" />
              ニックネーム
            </span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="ニックネーム"
              className="bg-camp-cream border-2 border-camp-wheat rounded-xl px-3 py-2.5 text-camp-dark text-base placeholder:text-camp-wheat/80 outline-none focus:border-camp-orange focus:ring-2 focus:ring-camp-orange/20 transition-all"
            />
          </label>
          {error && <p role="alert" className="text-camp-destructive text-xs">{error}</p>}
          <button
            type="submit"
            disabled={loading || !name.trim()}
            className="text-white font-bold py-3 rounded-xl disabled:opacity-40 active:scale-95 transition-all duration-150 flex items-center justify-center gap-2"
            style={{
              background: 'linear-gradient(135deg, #e07b39, #c8601a)',
              boxShadow: '0 6px 16px rgba(224,123,57,0.4)',
            }}
          >
            <FontAwesomeIcon icon={faCampground} />
            {loading ? '作成中...' : 'セッションを作成'}
          </button>
        </form>
      </main>
    </div>
  )
}
```

- [ ] **Step 3: テストがパスすることを確認**

```bash
npm test -- --reporter=verbose SessionCreate 2>&1 | tail -20
```

- [ ] **Step 4: コミット**

```bash
git add src/components/SessionCreate.tsx
git commit -m "style: SessionCreate グラデーション・フォームカード・FontAwesome 適用"
```

---

## Task 5: SessionJoin.tsx

**Files:**
- Modify: `src/components/SessionJoin.tsx`

- [ ] **Step 1: テストがパスすることを確認**

```bash
npm test -- --reporter=verbose SessionJoin 2>&1 | tail -20
```

- [ ] **Step 2: `src/components/SessionJoin.tsx` を以下に置き換え**

```tsx
import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faChevronLeft, faHashtag, faUser, faRightToBracket } from '@fortawesome/free-solid-svg-icons'
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
    <div className="flex flex-col min-h-screen" style={{ background: 'linear-gradient(170deg, #fdf6ec, #fff8f0)' }}>
      <header
        className="px-4 py-3 flex items-center"
        style={{ background: 'linear-gradient(135deg, #5a2800, #7c4a1e, #b06228)' }}
      >
        <button
          onClick={() => navigate(-1)}
          className="text-camp-cream/70 text-sm font-medium flex items-center gap-1 active:scale-95 transition-all duration-150"
        >
          <FontAwesomeIcon icon={faChevronLeft} className="text-xs" />
          戻る
        </button>
        <h2 className="text-camp-cream font-bold text-sm mx-auto">セッション参加</h2>
      </header>
      <main className="flex flex-col items-center justify-center flex-1 px-6">
        <form
          onSubmit={handleSubmit}
          className="w-full max-w-sm bg-white rounded-[18px] p-6 flex flex-col gap-4"
          style={{ boxShadow: '0 6px 24px rgba(124,74,30,0.14)', border: '1px solid rgba(240,200,150,0.4)' }}
        >
          <label className="flex flex-col gap-1.5">
            <span className="text-camp-brown text-sm font-semibold tracking-wide flex items-center gap-1.5">
              <FontAwesomeIcon icon={faHashtag} className="text-camp-amber text-xs" />
              6桁コード
            </span>
            <input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="123456"
              maxLength={6}
              className="bg-camp-cream border-2 border-camp-wheat rounded-xl px-3 py-2.5 text-camp-dark text-base tracking-widest placeholder:text-camp-wheat/80 outline-none focus:border-camp-orange focus:ring-2 focus:ring-camp-orange/20 uppercase transition-all"
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-camp-brown text-sm font-semibold tracking-wide flex items-center gap-1.5">
              <FontAwesomeIcon icon={faUser} className="text-camp-amber text-xs" />
              ニックネーム
            </span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="ニックネーム"
              className="bg-camp-cream border-2 border-camp-wheat rounded-xl px-3 py-2.5 text-camp-dark text-base placeholder:text-camp-wheat/80 outline-none focus:border-camp-orange focus:ring-2 focus:ring-camp-orange/20 transition-all"
            />
          </label>
          {error && <p role="alert" className="text-camp-destructive text-xs">{error}</p>}
          <button
            type="submit"
            disabled={!code.trim() || !name.trim() || loading}
            className="text-white font-bold py-3 rounded-xl disabled:opacity-40 active:scale-95 transition-all duration-150 flex items-center justify-center gap-2"
            style={{
              background: 'linear-gradient(135deg, #e07b39, #c8601a)',
              boxShadow: '0 6px 16px rgba(224,123,57,0.4)',
            }}
          >
            <FontAwesomeIcon icon={faRightToBracket} />
            参加する
          </button>
        </form>
      </main>
    </div>
  )
}
```

- [ ] **Step 3: テストがパスすることを確認**

```bash
npm test -- --reporter=verbose SessionJoin 2>&1 | tail -20
```

- [ ] **Step 4: コミット**

```bash
git add src/components/SessionJoin.tsx
git commit -m "style: SessionJoin グラデーション・フォームカード・FontAwesome 適用"
```

---

## Task 6: InviteScreen.tsx

**Files:**
- Modify: `src/components/InviteScreen.tsx`

- [ ] **Step 1: `src/components/InviteScreen.tsx` を以下に置き換え**

```tsx
import { useEffect, useState } from 'react'
import { useNavigate, useParams, useLocation } from 'react-router-dom'
import QRCode from 'qrcode'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faCrown, faUsers, faPlay } from '@fortawesome/free-solid-svg-icons'
import { useParticipants } from '../hooks/useParticipants'
import type { Session } from '../types/session'

export default function InviteScreen() {
  const { sessionId } = useParams<{ sessionId: string }>()
  const location = useLocation()
  const session = location.state?.session as Session | undefined
  const navigate = useNavigate()
  const [qrUrl, setQrUrl] = useState('')
  const [qrError, setQrError] = useState(false)
  const { participants } = useParticipants(sessionId ?? '')

  const MAX_PARTICIPANTS = 4

  const joinUrl = `${window.location.origin}/join/${session?.code}`

  useEffect(() => {
    if (session?.code) {
      QRCode.toDataURL(joinUrl).then(setQrUrl).catch(() => setQrError(true))
    }
  }, [joinUrl])

  if (!sessionId) return null

  return (
    <div className="flex flex-col min-h-screen" style={{ background: 'linear-gradient(170deg, #fdf6ec, #fff8f0)' }}>
      <header
        className="px-4 py-3 flex items-center justify-center"
        style={{ background: 'linear-gradient(135deg, #5a2800, #7c4a1e, #b06228)' }}
      >
        <h2 className="text-camp-cream font-bold text-sm">メンバーを招待</h2>
      </header>
      <main className="flex flex-col items-center justify-center flex-1 gap-5 px-6">
        <div
          className="bg-white rounded-2xl p-6 flex flex-col items-center gap-4 w-full max-w-xs"
          style={{ boxShadow: '0 6px 24px rgba(124,74,30,0.14)', border: '1px solid rgba(240,200,150,0.4)' }}
        >
          {qrUrl ? (
            <img src={qrUrl} alt="QR Code" className="w-36 h-36 rounded-xl" />
          ) : qrError ? (
            <p className="text-camp-destructive text-xs">QR生成に失敗</p>
          ) : null}
          <span
            className="text-camp-cream font-bold tracking-widest px-6 py-1.5 rounded-lg text-lg"
            style={{ background: 'linear-gradient(135deg, #e07b39, #c8601a)' }}
          >
            {session?.code}
          </span>
          <p className="text-camp-amber text-sm font-medium flex items-center gap-1.5">
            <FontAwesomeIcon icon={faUsers} className="text-xs" />
            {participants.length} / {MAX_PARTICIPANTS} 人参加中
          </p>
          <ul className="w-full space-y-1">
            {[...participants]
              .sort((a, b) =>
                a.auth_id === session?.host_auth_id ? -1 :
                b.auth_id === session?.host_auth_id ? 1 : 0
              )
              .map((p) => (
                <li key={p.id} className="text-camp-brown text-sm text-center flex items-center justify-center gap-1">
                  {p.auth_id === session?.host_auth_id && (
                    <FontAwesomeIcon icon={faCrown} className="text-camp-amber text-xs" />
                  )}
                  {p.name}
                </li>
              ))}
          </ul>
        </div>
        <button
          onClick={() => navigate(`/session/${sessionId}`, { state: { session } })}
          className="w-full max-w-xs text-white font-bold py-3 rounded-xl active:scale-95 transition-all duration-150 flex items-center justify-center gap-2"
          style={{
            background: 'linear-gradient(135deg, #e07b39, #c8601a)',
            boxShadow: '0 6px 16px rgba(224,123,57,0.4)',
          }}
        >
          <FontAwesomeIcon icon={faPlay} />
          スタート
        </button>
      </main>
    </div>
  )
}
```

- [ ] **Step 2: コミット**

```bash
git add src/components/InviteScreen.tsx
git commit -m "style: InviteScreen グラデーション・カード影・FontAwesome 適用"
```

---

## Task 7: YouTubePlayer.tsx

**Files:**
- Modify: `src/components/YouTubePlayer.tsx`

- [ ] **Step 1: テストがパスすることを確認**

```bash
npm test -- --reporter=verbose YouTubePlayer 2>&1 | tail -20
```

- [ ] **Step 2: `src/components/YouTubePlayer.tsx` を以下に置き換え**

```tsx
import YouTube from 'react-youtube'
import { useEffect, useRef } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faBackwardStep, faForwardStep, faPlay, faPause } from '@fortawesome/free-solid-svg-icons'

interface Props {
  videoId?: string
  playlistId?: string
  isPlaying: boolean
  onPlayToggle: () => void
  onEnded: () => void
  onError?: () => void
  onPrev: () => void
  onNext: () => void
  hasPrev: boolean
  hasNext: boolean
}

export default function YouTubePlayer({
  videoId, playlistId, isPlaying, onPlayToggle, onEnded, onError, onPrev, onNext, hasPrev, hasNext,
}: Props) {
  const playerRef = useRef<{ playVideo: () => void; pauseVideo: () => void } | null>(null)

  useEffect(() => {
    const p = playerRef.current
    if (!p) return
    if (isPlaying) {
      p.playVideo()
    } else {
      p.pauseVideo()
    }
  }, [isPlaying])

  const playerVars = playlistId
    ? { autoplay: 0, list: playlistId, listType: 'playlist' as const }
    : { autoplay: 0 }

  return (
    <div className="flex flex-col gap-3">
      <YouTube
        videoId={videoId ?? ''}
        opts={{ width: '200', height: '113', playerVars }}
        onReady={(event) => {
          playerRef.current = event.target as { playVideo: () => void; pauseVideo: () => void }
          if (isPlaying) event.target.playVideo()
        }}
        onEnd={onEnded}
        onError={onError}
      />
      <div className="flex justify-center items-center gap-5">
        <button
          onClick={onPrev}
          disabled={!hasPrev}
          aria-label="前へ"
          className="text-camp-cream/40 disabled:opacity-20 active:scale-90 transition-all duration-150"
        >
          <FontAwesomeIcon icon={faBackwardStep} className="text-xl" />
        </button>
        <button
          onClick={onPlayToggle}
          aria-label={isPlaying ? '停止' : '再生'}
          className="w-11 h-11 rounded-full flex items-center justify-center active:scale-90 transition-all duration-150"
          style={{
            background: 'linear-gradient(135deg, #e07b39, #c8601a)',
            boxShadow: '0 4px 14px rgba(224,123,57,0.55)',
          }}
        >
          <FontAwesomeIcon icon={isPlaying ? faPause : faPlay} className="text-white" />
        </button>
        <button
          onClick={onNext}
          disabled={!hasNext}
          aria-label="次へ"
          className="text-camp-cream/40 disabled:opacity-20 active:scale-90 transition-all duration-150"
        >
          <FontAwesomeIcon icon={faForwardStep} className="text-xl" />
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: テストがパスすることを確認（aria-label 検索は変更なし）**

```bash
npm test -- --reporter=verbose YouTubePlayer 2>&1 | tail -20
```

期待: PASS（ボタンの `aria-label` はそのまま維持）

- [ ] **Step 4: コミット**

```bash
git add src/components/YouTubePlayer.tsx
git commit -m "style: YouTubePlayer コントロール UI リデザイン・FontAwesome 適用"
```

---

## Task 8: MainPage.tsx + テスト更新

**重要:** MainPage のテストは `'👥 2/4'`・`'👑 Alice'`・`'📷 Alice...'`・`'🎵 Bob...'` などの絵文字テキストをチェックしている。FA アイコンは SVG として描画されるため、これらのテキストは DOM に存在しなくなる。テストを先に更新してから実装する（TDD 順序）。

**Files:**
- Modify: `src/components/MainPage.test.tsx`
- Modify: `src/components/MainPage.tsx`

- [ ] **Step 1: テスト更新前にベースライン確認**

```bash
npm test -- --reporter=verbose MainPage 2>&1 | tail -30
```

全テスト PASS を確認。

- [ ] **Step 2: `src/components/MainPage.test.tsx` の絵文字アサーションを更新**

以下の4箇所を変更する（他はそのまま）:

**変更箇所 1 — 行 122 付近（参加者数バッジ）:**
```tsx
// 変更前:
expect(screen.getByText('👥 2/4')).toBeInTheDocument()

// 変更後:
expect(screen.getByText('2/4')).toBeInTheDocument()
```

**変更箇所 2 — 行 207-211 付近（ホストに王冠が付く）:**
```tsx
// 変更前:
expect(await screen.findByText('👑 Alice')).toBeInTheDocument()

// 変更後:
expect(await screen.findByText('Alice')).toBeInTheDocument()
```

**変更箇所 3 — 行 226-229 付近（ホストが先頭に表示される）:**
```tsx
// 変更前:
await screen.findByText('👑 Alice')
const items = screen.getAllByRole('listitem')
expect(items[0]).toHaveTextContent('👑 Alice')
expect(items[1]).toHaveTextContent('Bob')

// 変更後:
await screen.findByText('Alice')
const items = screen.getAllByRole('listitem')
expect(items[0]).toHaveTextContent('Alice')
expect(items[1]).toHaveTextContent('Bob')
```

**変更箇所 4 — トーストテスト（行 258-294 付近、4箇所のアサーション）:**
```tsx
// 変更前（4箇所同様のパターン）:
expect(screen.getByText('📷 Aliceさんが写真を追加しました')).toBeInTheDocument()
expect(screen.getByText('🎵 Bobさんが音楽を追加しました')).toBeInTheDocument()
expect(screen.getByText('📷 メンバーさんが写真を追加しました')).toBeInTheDocument()
// （3秒後消去テストの2箇所も同様）

// 変更後（絵文字を除いたテキストのみチェック）:
expect(screen.getByText('Aliceさんが写真を追加しました')).toBeInTheDocument()
expect(screen.getByText('Bobさんが音楽を追加しました')).toBeInTheDocument()
expect(screen.getByText('メンバーさんが写真を追加しました')).toBeInTheDocument()
// （3秒後消去テストの2箇所も同様）
```

- [ ] **Step 3: 更新したテストが失敗することを確認（実装前なので当然）**

```bash
npm test -- --reporter=verbose MainPage 2>&1 | tail -30
```

期待: 上記変更した4テストが FAIL（まだ古い実装のまま）。

- [ ] **Step 4: `src/components/MainPage.tsx` を以下に置き換え**

```tsx
import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate, useLocation, useParams } from 'react-router-dom'
import QRCode from 'qrcode'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core'
import {
  faCampground, faCamera, faMusic, faUsers, faCrown,
} from '@fortawesome/free-solid-svg-icons'
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
  const [toast, setToast] = useState<{ icon: IconDefinition; message: string; id: number } | null>(null)
  const toastIdRef = useRef(0)

  const MAX_PARTICIPANTS = 4

  const resolveName = useCallback(
    (authId: string) => participants.find((p) => p.auth_id === authId)?.name ?? 'メンバー',
    [participants]
  )

  const showToast = useCallback((icon: IconDefinition, message: string) => {
    const id = ++toastIdRef.current
    setToast({ icon, message, id })
  }, [])

  const { photos } = usePhotos(sessionId!, {
    onInsert: (photo: Photo) =>
      showToast(faCamera, `${resolveName(photo.uploader_auth_id)}さんが写真を追加しました`),
  })

  const handleMusicAdd = (link: MusicLink) =>
    showToast(faMusic, `${resolveName(link.added_by_auth_id)}さんが音楽を追加しました`)

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
    'flex-1 flex flex-col gap-1 py-2 text-xs rounded-xl ' +
    'text-camp-cream/40 data-[state=active]:text-camp-cream ' +
    'data-[state=active]:bg-white/[0.13] ' +
    'bg-transparent transition-all duration-200 data-[state=active]:shadow-none'

  return (
    <div className="flex flex-col h-dvh" style={{ background: 'linear-gradient(170deg, #fdf6ec, #fff8f0)' }}>
      <header
        className="px-4 py-3 flex items-center justify-between flex-shrink-0"
        style={{ background: 'linear-gradient(135deg, #5a2800, #7c4a1e, #b06228)' }}
      >
        <span className="text-camp-cream font-bold text-sm flex items-center gap-1.5">
          <FontAwesomeIcon icon={faCampground} />
          CampCanvas
        </span>
        <div
          className="flex items-center gap-1 rounded-full px-2.5 py-1"
          style={{ background: 'rgba(253,246,236,0.12)' }}
        >
          <FontAwesomeIcon icon={faUsers} className="text-camp-cream/70 text-xs" />
          <span className="text-camp-cream/70 text-xs">{participants.length}/{MAX_PARTICIPANTS}</span>
        </div>
      </header>

      {toast && (
        <div
          role="status"
          className="text-camp-cream text-sm px-4 py-2 text-center flex-shrink-0 flex items-center justify-center gap-2 animate-slide-down"
          style={{ background: 'linear-gradient(135deg, rgba(61,32,3,0.92), rgba(90,40,0,0.92))' }}
        >
          <FontAwesomeIcon icon={toast.icon} />
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
              isHost={isHost}
              onMusicAdd={handleMusicAdd}
            />
          )}
        </TabsContent>

        <TabsContent value="member" className="flex-1 overflow-y-auto p-4 space-y-4 mt-0">
          <p className="text-center text-camp-amber text-sm font-medium">
            {participants.length} / {MAX_PARTICIPANTS} 人参加中
          </p>
          <ul className="space-y-1">
            {[...participants]
              .sort((a, b) =>
                a.auth_id === session?.host_auth_id ? -1 :
                b.auth_id === session?.host_auth_id ? 1 : 0
              )
              .map((p) => (
                <li key={p.id} className="text-camp-brown text-sm text-center flex items-center justify-center gap-1">
                  {p.auth_id === session?.host_auth_id && (
                    <FontAwesomeIcon icon={faCrown} className="text-camp-amber text-xs" />
                  )}
                  {p.name}
                </li>
              ))}
          </ul>
          {isHost && (
            <>
              <div
                className="bg-white border border-camp-wheat rounded-xl p-4 flex flex-col items-center gap-3"
                style={{ boxShadow: '0 4px 14px rgba(124,74,30,0.10)' }}
              >
                {qrUrl ? (
                  <img src={qrUrl} alt="QR Code" className="w-32 h-32 rounded-lg" />
                ) : qrError ? (
                  <p className="text-camp-destructive text-xs">QR生成に失敗</p>
                ) : null}
                <span
                  className="text-camp-cream font-bold tracking-widest px-4 py-1 rounded-md text-sm"
                  style={{ background: 'linear-gradient(135deg, #e07b39, #c8601a)' }}
                >
                  {session?.code}
                </span>
              </div>
              <button
                onClick={handleEnd}
                disabled={loading}
                className="w-full border-2 border-camp-destructive text-camp-destructive font-bold py-3 rounded-xl bg-transparent active:scale-95 transition-all duration-150"
              >
                セッション終了
              </button>
            </>
          )}
        </TabsContent>

        <TabsList
          className="flex-shrink-0 w-full rounded-none h-auto py-1 px-1.5 gap-1 justify-around"
          style={{ background: 'linear-gradient(135deg, #5a2800, #7c4a1e)' }}
        >
          <TabsTrigger value="photo" className={tabTriggerClass}>
            <FontAwesomeIcon icon={faCamera} />
            <span>写真</span>
          </TabsTrigger>
          <TabsTrigger value="music" className={tabTriggerClass}>
            <FontAwesomeIcon icon={faMusic} />
            <span>音楽</span>
          </TabsTrigger>
          <TabsTrigger value="member" className={tabTriggerClass}>
            <FontAwesomeIcon icon={faUsers} />
            <span>メンバー</span>
          </TabsTrigger>
        </TabsList>
      </Tabs>
    </div>
  )
}
```

- [ ] **Step 5: テストがすべてパスすることを確認**

```bash
npm test -- --reporter=verbose MainPage 2>&1 | tail -40
```

期待: 全テスト PASS

- [ ] **Step 6: コミット**

```bash
git add src/components/MainPage.tsx src/components/MainPage.test.tsx
git commit -m "style: MainPage ヘッダー・タブ・トースト・メンバーリストをリデザイン + テスト更新"
```

---

## Task 9: MusicPanel.tsx

**Files:**
- Modify: `src/components/MusicPanel.tsx`

- [ ] **Step 1: テストがパスすることを確認**

```bash
npm test -- --reporter=verbose MusicPanel 2>&1 | tail -20
```

- [ ] **Step 2: `src/components/MusicPanel.tsx` の先頭 import を更新**

ファイル冒頭の import 群を以下に置き換え:

```tsx
import { useEffect, useState, useRef } from 'react'
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors } from '@dnd-kit/core'
import type { DragEndEvent } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faGripVertical, faXmark, faMagnifyingGlass, faList, faPlus,
} from '@fortawesome/free-solid-svg-icons'
import { faYoutube } from '@fortawesome/free-brands-svg-icons'
import { Tabs, TabsList, TabsTrigger, TabsContent } from './ui/tabs'
import { useMusicLinks } from '../hooks/useMusicLinks'
import { useAddMusicLink } from '../hooks/useAddMusicLink'
import { useReorderMusicLink } from '../hooks/useReorderMusicLink'
import { useYouTubeSearch } from '../hooks/useYouTubeSearch'
import { useYouTubeVideoTitle } from '../hooks/useYouTubeVideoTitle'
import { usePlaylistItems } from '../hooks/usePlaylistItems'
import YouTubePlayer from './YouTubePlayer'
import AmbientPlayer from './AmbientPlayer'
import { extractYouTubeId, extractPlaylistId } from '../utils/youtube'
import { getAmbientVideoId } from '../utils/ambient'
import type { MusicLink } from '../types/session'
```

- [ ] **Step 3: `SortableQueueItem` コンポーネントを置き換え**

ファイル内の `function SortableQueueItem` 全体を以下に置き換え:

```tsx
function SortableQueueItem({
  link, index, currentIndex, currentUserId, loading, onDelete,
}: {
  link: MusicLink
  index: number
  currentIndex: number
  currentUserId: string
  loading: boolean
  onDelete: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: link.id })
  const isCurrent = index === currentIndex
  return (
    <li
      ref={setNodeRef}
      aria-current={isCurrent ? true : undefined}
      className={`flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm relative overflow-hidden transition-shadow duration-200 bg-white ${
        isCurrent ? 'text-camp-dark' : 'text-camp-dark opacity-80'
      }`}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
        ...(isCurrent
          ? { boxShadow: '0 4px 14px rgba(124,74,30,0.16)', border: '1px solid rgba(224,123,57,0.3)' }
          : { boxShadow: '0 2px 8px rgba(124,74,30,0.08)', border: '1px solid rgba(240,200,150,0.4)' }),
      }}
    >
      {isCurrent && (
        <div
          className="absolute left-0 top-0 bottom-0 w-[3px] rounded-l-xl"
          style={{ background: 'linear-gradient(180deg, #e07b39, #c8954a)', animation: 'pulse-glow 2s ease-in-out infinite' }}
        />
      )}
      <button
        type="button"
        aria-label="並び替え"
        {...attributes}
        {...listeners}
        className="cursor-grab flex-shrink-0 text-camp-brown/30 hover:text-camp-brown/60 transition-colors ml-1"
      >
        <FontAwesomeIcon icon={faGripVertical} className="text-sm" />
      </button>
      <span className={`flex-1 truncate text-sm ${isCurrent ? 'font-semibold' : ''}`}>
        {link.title || link.url}
      </span>
      {isCurrent && (
        <span
          className="text-xs text-camp-orange px-2 py-0.5 rounded-md flex-shrink-0"
          style={{ background: 'rgba(224,123,57,0.1)' }}
        >
          再生中
        </span>
      )}
      {link.added_by_auth_id === currentUserId && (
        <button
          type="button"
          aria-label="削除"
          onClick={onDelete}
          disabled={loading}
          className="text-camp-brown/30 hover:text-camp-brown/60 transition-colors flex-shrink-0 disabled:opacity-30"
        >
          <FontAwesomeIcon icon={faXmark} className="text-sm" />
        </button>
      )}
    </li>
  )
}
```

**注意:** `SortableQueueItem` の `className` と `style` を両方使っているが、`style` は条件分岐なので JSX の `style` prop で記述。`className` の `${isCurrent ? ... : ...}` 内の文字列に `style` の値を混入しないこと。

- [ ] **Step 4: `MusicPanel` return の JSX を置き換え**

`export default function MusicPanel` の return 文全体（`return (` から末尾 `)` まで）を以下に置き換え:

```tsx
  return (
    <div className="flex flex-col h-full">
      {isHost && (
        <div
          className="px-4 py-4 flex flex-col gap-3"
          style={{ background: 'linear-gradient(160deg, #1a0800, #3d1c06)' }}
        >
          {(videoId || playlistId) ? (
            <>
              <div className="flex items-center gap-1.5 text-camp-cream/30 text-xs">
                <FontAwesomeIcon icon={faYoutube} className="text-red-400/60 text-sm" />
                <span className="truncate">{links[currentIndex]?.title || '読み込み中...'}</span>
              </div>
              <YouTubePlayer
                key={currentLink?.id ?? 'empty'}
                videoId={videoId ?? undefined}
                playlistId={playlistId ?? undefined}
                isPlaying={isPlaying}
                onPlayToggle={() => setIsPlaying((p) => !p)}
                onEnded={handleEnded}
                onError={handleError}
                onPrev={() => setCurrentIndex((prev) => (prev - 1 + links.length) % links.length)}
                onNext={handleEnded}
                hasPrev={links.length > 1}
                hasNext={links.length > 1}
              />
            </>
          ) : (
            <AmbientPlayer videoId={getAmbientVideoId()} />
          )}
          {skipToast && (
            <p role="status" className="text-camp-wheat text-xs text-center">再生できないためスキップしました</p>
          )}
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
        <div
          className="bg-white rounded-xl p-3"
          style={{ boxShadow: '0 2px 10px rgba(124,74,30,0.08)', border: '1px solid rgba(240,200,150,0.35)' }}
        >
          <Tabs defaultValue="search">
            <TabsList className="w-full bg-camp-warm-white">
              <TabsTrigger value="search" className="flex-1 text-xs">検索</TabsTrigger>
              <TabsTrigger value="url" className="flex-1 text-xs">URL入力</TabsTrigger>
            </TabsList>

            <TabsContent value="search" className="flex flex-col gap-2 mt-2">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') void search(searchQuery) }}
                  placeholder="曲名・アーティスト名で検索"
                  className="flex-1 bg-camp-warm-white border border-camp-wheat rounded-xl px-3 py-2 text-base text-camp-dark outline-none focus:border-camp-orange focus:ring-2 focus:ring-camp-orange/20 transition-all"
                />
                <button
                  type="button"
                  onClick={() => void search(searchQuery)}
                  disabled={searchLoading || !searchQuery.trim()}
                  className="text-white text-sm font-bold px-3 py-2 rounded-xl disabled:opacity-40 active:scale-95 transition-all duration-150"
                  style={{ background: 'linear-gradient(135deg, #e07b39, #c8601a)' }}
                >
                  <FontAwesomeIcon icon={faMagnifyingGlass} />
                </button>
              </div>
              {searchError && <p role="alert" className="text-camp-destructive text-xs">{searchError}</p>}
              {error && <p role="alert" className="text-camp-destructive text-xs">{error}</p>}
              <ul className="flex flex-col gap-1.5">
                {results.map((item) => (
                  <li
                    key={item.videoId}
                    className="flex items-center gap-2 rounded-xl px-2 py-2 bg-white active:shadow-md transition-shadow duration-150"
                    style={{ boxShadow: '0 2px 8px rgba(124,74,30,0.09)', border: '1px solid rgba(240,200,150,0.35)' }}
                  >
                    <img
                      src={item.thumbnail}
                      alt={item.title}
                      className="w-12 h-9 object-cover rounded-lg flex-shrink-0"
                    />
                    <span className="flex-1 text-xs text-camp-dark truncate">{item.title}</span>
                    <button
                      type="button"
                      aria-label={`${item.title}を先頭に追加`}
                      onClick={() => void handleAddFromSearch(item.videoId, item.title, 'head')}
                      disabled={loading}
                      className="text-xs text-white font-bold px-2 py-1 rounded-lg disabled:opacity-40 flex-shrink-0 active:scale-95 transition-all duration-150"
                      style={{ background: 'linear-gradient(135deg, #e07b39, #c8601a)' }}
                    >
                      先頭
                    </button>
                    <button
                      type="button"
                      aria-label={`${item.title}を末尾に追加`}
                      onClick={() => void handleAddFromSearch(item.videoId, item.title, 'tail')}
                      disabled={loading}
                      className="text-xs text-white font-bold px-2 py-1 rounded-lg disabled:opacity-40 flex-shrink-0 active:scale-95 transition-all duration-150"
                      style={{ background: 'linear-gradient(135deg, #e07b39, #c8601a)' }}
                    >
                      末尾
                    </button>
                  </li>
                ))}
              </ul>
            </TabsContent>

            <TabsContent value="url" className="flex flex-col gap-2 mt-2">
              <input
                type="text"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                onBlur={() => { if (urlInput && !extractPlaylistId(urlInput)) void fetchTitle(urlInput) }}
                placeholder="YouTube / YouTube Music URL"
                className="w-full bg-camp-warm-white border border-camp-wheat rounded-xl px-3 py-2 text-base text-camp-dark outline-none focus:border-camp-orange focus:ring-2 focus:ring-camp-orange/20 transition-all"
              />
              {titleLoading && (
                <p className="text-camp-wheat text-xs">タイトル取得中...</p>
              )}
              {fetchedTitle && (
                <p className="text-camp-dark text-xs truncate">タイトル: {fetchedTitle}</p>
              )}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => void handleAddFromUrl('head')}
                  disabled={loading || !!playlistProgress || !urlInput.trim()}
                  className="flex-1 text-white text-sm font-bold px-3 py-2 rounded-xl disabled:opacity-40 active:scale-95 transition-all duration-150 flex items-center justify-center gap-1.5"
                  style={{ background: 'linear-gradient(135deg, #e07b39, #c8601a)' }}
                >
                  <FontAwesomeIcon icon={faPlus} className="text-xs" />
                  先頭に追加
                </button>
                <button
                  type="button"
                  onClick={() => void handleAddFromUrl('tail')}
                  disabled={loading || !!playlistProgress || !urlInput.trim()}
                  className="flex-1 text-white text-sm font-bold px-3 py-2 rounded-xl disabled:opacity-40 active:scale-95 transition-all duration-150 flex items-center justify-center gap-1.5"
                  style={{ background: 'linear-gradient(135deg, #e07b39, #c8601a)' }}
                >
                  <FontAwesomeIcon icon={faPlus} className="text-xs" />
                  末尾に追加
                </button>
              </div>
              {playlistProgress && (
                <p className="text-camp-wheat text-xs">
                  {playlistProgress.phase === 'fetching'
                    ? 'プレイリスト取得中...'
                    : `${playlistProgress.total}件をキューに追加中...`}
                </p>
              )}
              {(error ?? playlistError) && (
                <p role="alert" className="text-camp-destructive text-xs">{error ?? playlistError}</p>
              )}
            </TabsContent>
          </Tabs>
        </div>

        <div
          className="rounded-xl p-3 flex flex-col gap-2"
          style={{ background: 'linear-gradient(170deg, #fff8f0, #fdf6ec)', boxShadow: '0 2px 10px rgba(124,74,30,0.07)', border: '1px solid rgba(240,200,150,0.4)' }}
        >
          <span className="text-camp-amber text-xs font-bold uppercase tracking-wider flex items-center gap-1.5">
            <FontAwesomeIcon icon={faList} className="text-xs" />
            キュー
          </span>

          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={links.map(l => l.id)} strategy={verticalListSortingStrategy}>
              <ul className="flex flex-col gap-2">
                {links.map((link, index) => (
                  <SortableQueueItem
                    key={link.id}
                    link={link}
                    index={index}
                    currentIndex={currentIndex}
                    currentUserId={currentUserId}
                    loading={loading}
                    onDelete={() => handleDelete(link, index)}
                  />
                ))}
              </ul>
            </SortableContext>
          </DndContext>
        </div>
      </div>
    </div>
  )
```

- [ ] **Step 5: テストがすべてパスすることを確認**

```bash
npm test -- --reporter=verbose MusicPanel 2>&1 | tail -30
```

- [ ] **Step 6: 全テストスイートを実行して回帰がないことを確認**

```bash
npm test 2>&1 | tail -20
```

期待: 全テスト PASS

- [ ] **Step 7: コミット**

```bash
git add src/components/MusicPanel.tsx
git commit -m "style: MusicPanel プレイヤー・キュー・検索 UI をリデザイン・FontAwesome 適用"
```

---

## Task 10: 動作確認

- [ ] **Step 1: 開発サーバーを起動**

```bash
npm run dev
```

- [ ] **Step 2: ブラウザで各画面を確認**

確認項目:
- TopPage: グラデーションヘッダー、🏕 → campground アイコン、ボタンタップで scale-95
- SessionCreate: グラデーションヘッダー、フォームカード白背景・影、input フォーカスglow
- SessionJoin: SessionCreate と同様
- MainPage: グラデーションヘッダー、参加者数ピルバッジ、タブ切り替えピル型ハイライト
- MainPage（音楽タブ）: MusicPanel のダーク背景プレイヤー、白カードキュー
- トースト: 写真/音楽追加時にスライドイン

- [ ] **Step 3: 最終コミット（必要な調整があれば）**

```bash
git add -p  # 修正があれば
git commit -m "style: UI リデザイン 動作確認後の調整"
```
