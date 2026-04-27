# YouTube BGM Player 実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** MusicPanel の YouTube リンク表示を BGM 再生に置き換え、Spotify サポートを削除して YouTube 専用のキュープレイヤーをパネル内に埋め込む。

**Architecture:** react-youtube で YouTube IFrame API をラップした YouTubePlayer コンポーネントを新規作成し、MusicPanel が currentIndex / isPlaying state を保持してキュー管理を行う。URL → 動画ID 変換は youtube.ts ユーティリティに分離する。

**Tech Stack:** React 19, TypeScript, react-youtube, Vitest, @testing-library/react

---

## ファイル構成

### 新規作成
- `src/utils/youtube.ts` — `extractYouTubeId(url)` ユーティリティ
- `src/utils/youtube.test.ts` — `extractYouTubeId` ユニットテスト
- `src/components/YouTubePlayer.tsx` — react-youtube ラッパー + 再生コントロール UI
- `src/components/YouTubePlayer.test.tsx` — YouTubePlayer コンポーネントテスト

### 変更
- `src/hooks/useAddMusicLink.ts` — Spotify バリデーション削除
- `src/hooks/useAddMusicLink.test.ts` — Spotify テストケース削除
- `src/components/MusicPanel.tsx` — キュー state + YouTubePlayer 統合
- `src/components/MusicPanel.test.tsx` — 新機能テスト追加、既存テスト更新

---

### Task 1: react-youtube インストール

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`

- [ ] **Step 1: react-youtube をインストール**

```bash
npm install react-youtube
```

- [ ] **Step 2: 型定義が含まれることを確認**

```bash
ls node_modules/react-youtube/dist/*.d.ts
```

Expected: `YouTube.d.ts` などが表示される

- [ ] **Step 3: コミット**

```bash
git add package.json package-lock.json
git commit -m "chore: add react-youtube dependency"
```

---

### Task 2: extractYouTubeId ユーティリティ

**Files:**
- Create: `src/utils/youtube.test.ts`
- Create: `src/utils/youtube.ts`

- [ ] **Step 1: 失敗テストを書く**

`src/utils/youtube.test.ts` を新規作成:

```ts
import { describe, it, expect } from 'vitest'
import { extractYouTubeId } from './youtube'

describe('extractYouTubeId', () => {
  it('watch URL から ID を抽出', () => {
    expect(extractYouTubeId('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ')
  })
  it('クエリパラメータ付き watch URL から ID を抽出', () => {
    expect(extractYouTubeId('https://www.youtube.com/watch?v=dQw4w9WgXcQ&feature=share')).toBe('dQw4w9WgXcQ')
  })
  it('youtu.be 短縮 URL から ID を抽出', () => {
    expect(extractYouTubeId('https://youtu.be/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ')
  })
  it('youtu.be + クエリパラメータから ID を抽出', () => {
    expect(extractYouTubeId('https://youtu.be/dQw4w9WgXcQ?si=abc')).toBe('dQw4w9WgXcQ')
  })
  it('Spotify URL は null を返す', () => {
    expect(extractYouTubeId('https://open.spotify.com/track/abc')).toBeNull()
  })
  it('無効な文字列は null を返す', () => {
    expect(extractYouTubeId('not a url')).toBeNull()
  })
})
```

- [ ] **Step 2: テストが失敗することを確認**

```bash
npx vitest run src/utils/youtube.test.ts
```

Expected: FAIL — `Cannot find module './youtube'`

- [ ] **Step 3: 最小実装を書く**

`src/utils/youtube.ts` を新規作成:

```ts
export function extractYouTubeId(url: string): string | null {
  const watchMatch = url.match(/[?&]v=([^&]+)/)
  if (watchMatch) return watchMatch[1]
  const shortMatch = url.match(/youtu\.be\/([^?/]+)/)
  if (shortMatch) return shortMatch[1]
  return null
}
```

- [ ] **Step 4: テストが通ることを確認**

```bash
npx vitest run src/utils/youtube.test.ts
```

Expected: PASS — 6 tests pass

- [ ] **Step 5: コミット**

```bash
git add src/utils/youtube.ts src/utils/youtube.test.ts
git commit -m "feat: add extractYouTubeId utility"
```

---

### Task 3: useAddMusicLink バリデーション更新

**Files:**
- Modify: `src/hooks/useAddMusicLink.ts`
- Modify: `src/hooks/useAddMusicLink.test.ts`

- [ ] **Step 1: テストを更新する（新しい期待値に変更）**

`src/hooks/useAddMusicLink.test.ts` の `describe('isValidMusicUrl')` ブロック全体を以下で置き換える:

```ts
describe('isValidMusicUrl', () => {
  it('YouTube watch URL を許可', () => {
    expect(isValidMusicUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe(true)
  })
  it('youtu.be short URL を許可', () => {
    expect(isValidMusicUrl('https://youtu.be/dQw4w9WgXcQ')).toBe(true)
  })
  it('Spotify URL を拒否', () => {
    expect(isValidMusicUrl('https://open.spotify.com/track/abc')).toBe(false)
  })
  it('Twitter URL を拒否', () => {
    expect(isValidMusicUrl('https://twitter.com/something')).toBe(false)
  })
  it('任意の文字列を拒否', () => {
    expect(isValidMusicUrl('not a url')).toBe(false)
  })
})
```

`'無効URLで addLink'` テストのアサーションを以下に更新（末尾の `expect` を変更）:

```ts
it('無効URLで addLink: INSERT を呼ばずfalseを返す', async () => {
  const { result } = renderHook(() => useAddMusicLink())
  let ok: boolean | undefined
  await act(async () => {
    ok = await result.current.addLink('sess-1', 'https://twitter.com/foo')
  })
  expect(ok).toBe(false)
  expect(mockLinkInsert).not.toHaveBeenCalled()
  expect(result.current.error).toBe('YouTube の URL を入力してください')
})
```

- [ ] **Step 2: テストが失敗することを確認**

```bash
npx vitest run src/hooks/useAddMusicLink.test.ts
```

Expected: FAIL — `'Spotify URL を拒否'` が失敗（コードはまだ Spotify を許可している）

- [ ] **Step 3: useAddMusicLink.ts を更新**

`src/hooks/useAddMusicLink.ts` の `ALLOWED` 配列を置き換える:

```ts
const ALLOWED: RegExp[] = [
  /^https?:\/\/(www\.)?youtube\.com\/watch/,
  /^https?:\/\/youtu\.be\//,
]
```

エラーメッセージを更新:

```ts
if (!isValidMusicUrl(url)) {
  setError('YouTube の URL を入力してください')
  return false
}
```

- [ ] **Step 4: テストが通ることを確認**

```bash
npx vitest run src/hooks/useAddMusicLink.test.ts
```

Expected: PASS — 5 tests pass

- [ ] **Step 5: コミット**

```bash
git add src/hooks/useAddMusicLink.ts src/hooks/useAddMusicLink.test.ts
git commit -m "feat: restrict music link validation to YouTube only"
```

---

### Task 4: YouTubePlayer コンポーネント

**Files:**
- Create: `src/components/YouTubePlayer.test.tsx`
- Create: `src/components/YouTubePlayer.tsx`

- [ ] **Step 1: 失敗テストを書く**

`src/components/YouTubePlayer.test.tsx` を新規作成:

```tsx
import { render, screen, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import YouTubePlayer from './YouTubePlayer'

const { mockPlayVideo, mockPauseVideo, ytProps } = vi.hoisted(() => ({
  mockPlayVideo: vi.fn(),
  mockPauseVideo: vi.fn(),
  ytProps: {
    onReady: undefined as ((e: { target: unknown }) => void) | undefined,
    onEnd: undefined as (() => void) | undefined,
    onError: undefined as (() => void) | undefined,
  },
}))

vi.mock('react-youtube', () => ({
  default: (props: {
    videoId: string
    onReady?: (e: { target: unknown }) => void
    onEnd?: () => void
    onError?: () => void
  }) => {
    ytProps.onReady = props.onReady
    ytProps.onEnd = props.onEnd
    ytProps.onError = props.onError
    props.onReady?.({ target: { playVideo: mockPlayVideo, pauseVideo: mockPauseVideo } })
    return <div data-testid="yt-iframe" data-video-id={props.videoId} />
  },
}))

const baseProps = {
  videoId: 'dQw4w9WgXcQ',
  isPlaying: false,
  onPlayToggle: vi.fn(),
  onEnded: vi.fn(),
  onPrev: vi.fn(),
  onNext: vi.fn(),
  hasPrev: true,
  hasNext: true,
}

describe('YouTubePlayer', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    baseProps.onPlayToggle = vi.fn()
    baseProps.onPrev = vi.fn()
    baseProps.onNext = vi.fn()
    baseProps.onEnded = vi.fn()
  })

  it('YouTube iframe を videoId 付きでレンダリング', () => {
    render(<YouTubePlayer {...baseProps} />)
    expect(screen.getByTestId('yt-iframe')).toHaveAttribute('data-video-id', 'dQw4w9WgXcQ')
  })

  it('isPlaying=true のとき playVideo を呼ぶ', () => {
    render(<YouTubePlayer {...baseProps} isPlaying={true} />)
    expect(mockPlayVideo).toHaveBeenCalled()
  })

  it('isPlaying=false のとき pauseVideo を呼ぶ', () => {
    render(<YouTubePlayer {...baseProps} isPlaying={false} />)
    expect(mockPauseVideo).toHaveBeenCalled()
  })

  it('isPlaying=false のとき再生ボタンを表示', () => {
    render(<YouTubePlayer {...baseProps} isPlaying={false} />)
    expect(screen.getByRole('button', { name: '再生' })).toBeInTheDocument()
  })

  it('isPlaying=true のとき停止ボタンを表示', () => {
    render(<YouTubePlayer {...baseProps} isPlaying={true} />)
    expect(screen.getByRole('button', { name: '停止' })).toBeInTheDocument()
  })

  it('再生/停止ボタンクリックで onPlayToggle を呼ぶ', async () => {
    render(<YouTubePlayer {...baseProps} isPlaying={false} />)
    await userEvent.click(screen.getByRole('button', { name: '再生' }))
    expect(baseProps.onPlayToggle).toHaveBeenCalledOnce()
  })

  it('前へボタンクリックで onPrev を呼ぶ', async () => {
    render(<YouTubePlayer {...baseProps} />)
    await userEvent.click(screen.getByRole('button', { name: '前へ' }))
    expect(baseProps.onPrev).toHaveBeenCalledOnce()
  })

  it('次へボタンクリックで onNext を呼ぶ', async () => {
    render(<YouTubePlayer {...baseProps} />)
    await userEvent.click(screen.getByRole('button', { name: '次へ' }))
    expect(baseProps.onNext).toHaveBeenCalledOnce()
  })

  it('hasPrev=false のとき前へボタンが無効', () => {
    render(<YouTubePlayer {...baseProps} hasPrev={false} />)
    expect(screen.getByRole('button', { name: '前へ' })).toBeDisabled()
  })

  it('hasNext=false のとき次へボタンが無効', () => {
    render(<YouTubePlayer {...baseProps} hasNext={false} />)
    expect(screen.getByRole('button', { name: '次へ' })).toBeDisabled()
  })

  it('onError 発火でエラーメッセージ表示', () => {
    render(<YouTubePlayer {...baseProps} />)
    act(() => { ytProps.onError?.() })
    expect(screen.getByRole('alert')).toHaveTextContent('再生できません')
  })
})
```

- [ ] **Step 2: テストが失敗することを確認**

```bash
npx vitest run src/components/YouTubePlayer.test.tsx
```

Expected: FAIL — `Cannot find module './YouTubePlayer'`

- [ ] **Step 3: YouTubePlayer.tsx を実装**

`src/components/YouTubePlayer.tsx` を新規作成:

```tsx
import YouTube from 'react-youtube'
import { useEffect, useRef, useState } from 'react'

interface Props {
  videoId: string
  isPlaying: boolean
  onPlayToggle: () => void
  onEnded: () => void
  onPrev: () => void
  onNext: () => void
  hasPrev: boolean
  hasNext: boolean
}

export default function YouTubePlayer({
  videoId, isPlaying, onPlayToggle, onEnded, onPrev, onNext, hasPrev, hasNext,
}: Props) {
  const playerRef = useRef<{ playVideo: () => void; pauseVideo: () => void } | null>(null)
  const [playerError, setPlayerError] = useState(false)

  useEffect(() => {
    const p = playerRef.current
    if (!p) return
    if (isPlaying) {
      p.playVideo()
    } else {
      p.pauseVideo()
    }
  }, [isPlaying])

  return (
    <div>
      <YouTube
        videoId={videoId}
        opts={{ width: '200', height: '113', playerVars: { autoplay: 0 } }}
        onReady={(event) => {
          playerRef.current = event.target as { playVideo: () => void; pauseVideo: () => void }
        }}
        onEnd={onEnded}
        onError={() => setPlayerError(true)}
      />
      {playerError && <p role="alert">再生できません</p>}
      <div>
        <button onClick={onPrev} disabled={!hasPrev} aria-label="前へ">◀</button>
        <button onClick={onPlayToggle} aria-label={isPlaying ? '停止' : '再生'}>
          {isPlaying ? '⏸' : '▶'}
        </button>
        <button onClick={onNext} disabled={!hasNext} aria-label="次へ">▶▶</button>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: テストが通ることを確認**

```bash
npx vitest run src/components/YouTubePlayer.test.tsx
```

Expected: PASS — 11 tests pass

- [ ] **Step 5: コミット**

```bash
git add src/components/YouTubePlayer.tsx src/components/YouTubePlayer.test.tsx
git commit -m "feat: add YouTubePlayer component with queue controls"
```

---

### Task 5: MusicPanel 更新

**Files:**
- Modify: `src/components/MusicPanel.test.tsx`
- Modify: `src/components/MusicPanel.tsx`

- [ ] **Step 1: テストを更新する**

`src/components/MusicPanel.test.tsx` 全体を以下で置き換える:

```tsx
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import MusicPanel from './MusicPanel'
import type { MusicLink } from '../types/session'

const { mockAddLink, mockDeleteLink, mockLinks, mockYouTubePlayer } = vi.hoisted(() => ({
  mockAddLink: vi.fn(),
  mockDeleteLink: vi.fn(),
  mockLinks: { value: [] as MusicLink[] },
  mockYouTubePlayer: vi.fn(),
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

vi.mock('./YouTubePlayer', () => ({
  default: mockYouTubePlayer,
}))

const link1: MusicLink = {
  id: 'ml-1', session_id: 'sess-1', added_by_auth_id: 'uid-me',
  url: 'https://youtu.be/dQw4w9WgXcQ', created_at: '2026-04-26T10:00:00Z',
}
const link2: MusicLink = {
  id: 'ml-2', session_id: 'sess-1', added_by_auth_id: 'uid-other',
  url: 'https://youtu.be/abc1234', created_at: '2026-04-26T10:01:00Z',
}

describe('MusicPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockLinks.value = []
    mockYouTubePlayer.mockImplementation(
      ({ videoId, isPlaying }: { videoId: string; isPlaying: boolean }) => (
        <div data-testid="youtube-player" data-video-id={videoId} data-playing={String(isPlaying)} />
      )
    )
  })

  it('links が空のとき YouTubePlayer は表示されない', () => {
    render(<MusicPanel sessionId="sess-1" currentUserId="uid-me" />)
    expect(screen.queryByTestId('youtube-player')).not.toBeInTheDocument()
  })

  it('links があるとき YouTubePlayer に videoId が渡る', () => {
    mockLinks.value = [link1]
    render(<MusicPanel sessionId="sess-1" currentUserId="uid-me" />)
    expect(screen.getByTestId('youtube-player')).toHaveAttribute('data-video-id', 'dQw4w9WgXcQ')
  })

  it('URL 入力してボタンクリックで addLink を呼ぶ', async () => {
    mockAddLink.mockResolvedValue(true)
    render(<MusicPanel sessionId="sess-1" currentUserId="uid-me" />)
    await userEvent.type(screen.getByRole('textbox'), 'https://youtu.be/abc')
    await userEvent.click(screen.getByRole('button', { name: '追加' }))
    expect(mockAddLink).toHaveBeenCalledWith('sess-1', 'https://youtu.be/abc')
  })

  it('自分のリンクには削除ボタンが表示される', () => {
    mockLinks.value = [link1]
    render(<MusicPanel sessionId="sess-1" currentUserId="uid-me" />)
    expect(screen.getByRole('button', { name: '削除' })).toBeInTheDocument()
  })

  it('他人のリンクには削除ボタンが表示されない', () => {
    mockLinks.value = [link2]
    render(<MusicPanel sessionId="sess-1" currentUserId="uid-me" />)
    expect(screen.queryByRole('button', { name: '削除' })).not.toBeInTheDocument()
  })

  it('削除ボタンクリックで deleteLink を呼ぶ', async () => {
    mockLinks.value = [link1]
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

  it('先頭リンクに aria-current が付与される', () => {
    mockLinks.value = [link1, link2]
    render(<MusicPanel sessionId="sess-1" currentUserId="uid-me" />)
    const items = screen.getAllByRole('listitem')
    expect(items[0]).toHaveAttribute('aria-current', 'true')
    expect(items[1]).not.toHaveAttribute('aria-current', 'true')
  })
})
```

- [ ] **Step 2: テストが失敗することを確認**

```bash
npx vitest run src/components/MusicPanel.test.tsx
```

Expected: FAIL — `links が空のとき YouTubePlayer は表示されない` など複数が失敗

- [ ] **Step 3: MusicPanel.tsx を更新**

`src/components/MusicPanel.tsx` 全体を以下で置き換える:

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
    if (ok && isCurrent) {
      setIsPlaying(false)
      setCurrentIndex(0)
    }
  }

  const handleEnded = () => {
    setCurrentIndex((prev) => (prev + 1) % links.length)
  }

  const currentLink = links[currentIndex]
  const videoId = currentLink ? extractYouTubeId(currentLink.url) : null

  return (
    <div>
      {videoId && (
        <YouTubePlayer
          videoId={videoId}
          isPlaying={isPlaying}
          onPlayToggle={() => setIsPlaying((p) => !p)}
          onEnded={handleEnded}
          onPrev={() => setCurrentIndex((prev) => (prev - 1 + links.length) % links.length)}
          onNext={() => setCurrentIndex((prev) => (prev + 1) % links.length)}
          hasPrev={links.length > 1}
          hasNext={links.length > 1}
        />
      )}
      <div>
        <input
          type="text"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="YouTube URL"
        />
        <button onClick={handleAdd} disabled={loading || !url.trim()}>
          追加
        </button>
      </div>
      {error && <p role="alert">{error}</p>}
      <ul>
        {links.map((link, index) => (
          <li key={link.id} aria-current={index === currentIndex ? true : undefined}>
            {link.url}
            {link.added_by_auth_id === currentUserId && (
              <button
                aria-label="削除"
                onClick={() => handleDelete(link, index)}
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

- [ ] **Step 4: テストが通ることを確認**

```bash
npx vitest run src/components/MusicPanel.test.tsx
```

Expected: PASS — 8 tests pass

- [ ] **Step 5: 全テストスイートを実行**

```bash
npx vitest run
```

Expected: すべて PASS

- [ ] **Step 6: コミット**

```bash
git add src/components/MusicPanel.tsx src/components/MusicPanel.test.tsx
git commit -m "feat: integrate YouTubePlayer into MusicPanel with queue playback"
```
