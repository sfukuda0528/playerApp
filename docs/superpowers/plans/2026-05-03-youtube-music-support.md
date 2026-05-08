# YouTube Music リンク対応 実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `music.youtube.com` の個別曲・プレイリスト URL をキューに追加・再生できるようにする

**Architecture:** URL を `www.youtube.com` に正規化してから DB 保存。個別曲は既存フロー継続。プレイリストは `playlistId` を `YouTubePlayer` に渡し、YouTube iframe API の `playerVars.list` で連続再生。

**Tech Stack:** React 19, TypeScript, Vitest, react-youtube, Supabase

---

## File Map

| ファイル | 変更種別 |
|---|---|
| `src/utils/youtube.ts` | Modify — `normalizeMusicUrl` / `extractPlaylistId` 追加 |
| `src/utils/youtube.test.ts` | Modify — 上記2関数のテスト追加 |
| `src/hooks/useAddMusicLink.ts` | Modify — 正規化・プレイリスト ALLOWED 追加、エラーメッセージ更新 |
| `src/hooks/useAddMusicLink.test.ts` | Modify — 正規化・プレイリスト動作テスト追加、エラーメッセージ更新 |
| `src/components/YouTubePlayer.tsx` | Modify — `playlistId` prop 追加、opts 組み立て変更 |
| `src/components/YouTubePlayer.test.tsx` | Modify — playlist モードのテスト追加、mock に opts キャプチャ追加 |
| `src/components/MusicPanel.tsx` | Modify — `extractPlaylistId` 呼び出し、YouTubePlayer props 変更、placeholder 更新 |
| `src/components/MusicPanel.test.tsx` | Modify — プレイリスト URL テスト追加 |

---

## Task 1: `youtube.ts` に `normalizeMusicUrl` と `extractPlaylistId` を追加

**Files:**
- Modify: `src/utils/youtube.ts`
- Test: `src/utils/youtube.test.ts`

- [ ] **Step 1: テストを追加（Red）**

`src/utils/youtube.test.ts` の先頭 import 行を以下に置き換える:

```typescript
import { describe, it, expect } from 'vitest'
import { extractYouTubeId, normalizeMusicUrl, extractPlaylistId } from './youtube'
```

ファイル末尾に以下を追加する:

```typescript
describe('normalizeMusicUrl', () => {
  it('music.youtube.com/watch URL を www.youtube.com に変換', () => {
    expect(normalizeMusicUrl('https://music.youtube.com/watch?v=abc'))
      .toBe('https://www.youtube.com/watch?v=abc')
  })
  it('music.youtube.com/playlist URL を www.youtube.com に変換', () => {
    expect(normalizeMusicUrl('https://music.youtube.com/playlist?list=PLxxx'))
      .toBe('https://www.youtube.com/playlist?list=PLxxx')
  })
  it('www.youtube.com URL は変更しない', () => {
    expect(normalizeMusicUrl('https://www.youtube.com/watch?v=abc'))
      .toBe('https://www.youtube.com/watch?v=abc')
  })
  it('youtu.be URL は変更しない', () => {
    expect(normalizeMusicUrl('https://youtu.be/abc'))
      .toBe('https://youtu.be/abc')
  })
})

describe('extractPlaylistId', () => {
  it('playlist URL から list パラメータを抽出', () => {
    expect(extractPlaylistId('https://www.youtube.com/playlist?list=PLxxx')).toBe('PLxxx')
  })
  it('複数パラメータの playlist URL から list を抽出', () => {
    expect(extractPlaylistId('https://www.youtube.com/playlist?list=PLxxx&si=abc')).toBe('PLxxx')
  })
  it('watch URL（list パラメータなし）は null を返す', () => {
    expect(extractPlaylistId('https://www.youtube.com/watch?v=abc')).toBeNull()
  })
  it('youtu.be URL は null を返す', () => {
    expect(extractPlaylistId('https://youtu.be/abc')).toBeNull()
  })
})
```

- [ ] **Step 2: テストが失敗することを確認**

```bash
npx vitest run src/utils/youtube.test.ts
```

期待: `normalizeMusicUrl is not a function` または `is not exported` でFAIL

- [ ] **Step 3: 実装を追加（Green）**

`src/utils/youtube.ts` の末尾に追加する:

```typescript
export function normalizeMusicUrl(url: string): string {
  return url.replace(/^(https?:\/\/)music\.youtube\.com/, '$1www.youtube.com')
}

export function extractPlaylistId(url: string): string | null {
  const match = url.match(/[?&]list=([^&]+)/)
  return match ? match[1] : null
}
```

- [ ] **Step 4: テストが通ることを確認**

```bash
npx vitest run src/utils/youtube.test.ts
```

期待: 全テスト PASS（既存6件 + 新規8件 = 14件）

- [ ] **Step 5: コミット**

```bash
git add src/utils/youtube.ts src/utils/youtube.test.ts
git commit -m "feat: normalizeMusicUrl と extractPlaylistId を追加"
```

---

## Task 2: `useAddMusicLink.ts` をプレイリスト対応に更新

**Files:**
- Modify: `src/hooks/useAddMusicLink.ts`
- Test: `src/hooks/useAddMusicLink.test.ts`

- [ ] **Step 1: テストを更新・追加（Red）**

`src/hooks/useAddMusicLink.test.ts` を以下の完全な内容に置き換える:

```typescript
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
      insert: (data: unknown) => mockLinkInsert(data),
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
  it('youtube.com/playlist URL を許可', () => {
    expect(isValidMusicUrl('https://www.youtube.com/playlist?list=PLxxx')).toBe(true)
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
    expect(result.current.error).toBe('YouTube または YouTube Music の URL を入力してください')
  })

  it('music.youtube.com/watch URL を正規化して INSERT を呼ぶ', async () => {
    const { result } = renderHook(() => useAddMusicLink())
    await act(async () => {
      await result.current.addLink('sess-1', 'https://music.youtube.com/watch?v=abc')
    })
    expect(mockLinkInsert).toHaveBeenCalledWith(
      expect.objectContaining({ url: 'https://www.youtube.com/watch?v=abc' })
    )
  })

  it('youtube.com/playlist URL で addLink が true を返す', async () => {
    const { result } = renderHook(() => useAddMusicLink())
    let ok: boolean | undefined
    await act(async () => {
      ok = await result.current.addLink('sess-1', 'https://www.youtube.com/playlist?list=PLxxx')
    })
    expect(ok).toBe(true)
    expect(mockLinkInsert).toHaveBeenCalledOnce()
  })

  it('music.youtube.com/playlist URL を正規化して INSERT を呼ぶ', async () => {
    const { result } = renderHook(() => useAddMusicLink())
    await act(async () => {
      await result.current.addLink('sess-1', 'https://music.youtube.com/playlist?list=PLxxx')
    })
    expect(mockLinkInsert).toHaveBeenCalledWith(
      expect.objectContaining({ url: 'https://www.youtube.com/playlist?list=PLxxx' })
    )
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

- [ ] **Step 2: テストが失敗することを確認**

```bash
npx vitest run src/hooks/useAddMusicLink.test.ts
```

期待: `youtube.com/playlist URL を許可` / `music.youtube.com` 関連テストがFAIL、エラーメッセージテストがFAIL

- [ ] **Step 3: 実装を更新（Green）**

`src/hooks/useAddMusicLink.ts` を以下の完全な内容に置き換える:

```typescript
import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { normalizeMusicUrl } from '../utils/youtube'

const ALLOWED: RegExp[] = [
  /^https?:\/\/(www\.)?youtube\.com\/watch/,
  /^https?:\/\/youtu\.be\//,
  /^https?:\/\/(www\.)?youtube\.com\/playlist/,
]

export function isValidMusicUrl(url: string): boolean {
  return ALLOWED.some((re) => re.test(url))
}

export function useAddMusicLink() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const addLink = async (sessionId: string, url: string): Promise<boolean> => {
    setError(null)
    const normalized = normalizeMusicUrl(url)
    if (!isValidMusicUrl(normalized)) {
      setError('YouTube または YouTube Music の URL を入力してください')
      return false
    }
    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('認証が必要です')

      const { error: insertError } = await supabase
        .from('music_links')
        .insert({ session_id: sessionId, added_by_auth_id: user.id, url: normalized })
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

- [ ] **Step 4: テストが通ることを確認**

```bash
npx vitest run src/hooks/useAddMusicLink.test.ts
```

期待: 全テスト PASS（既存5件 + 新規4件 = 9件）

- [ ] **Step 5: コミット**

```bash
git add src/hooks/useAddMusicLink.ts src/hooks/useAddMusicLink.test.ts
git commit -m "feat: useAddMusicLink にプレイリスト対応・URL正規化を追加"
```

---

## Task 3: `YouTubePlayer.tsx` に `playlistId` prop を追加

**Files:**
- Modify: `src/components/YouTubePlayer.tsx`
- Test: `src/components/YouTubePlayer.test.tsx`

- [ ] **Step 1: テストを更新・追加（Red）**

`src/components/YouTubePlayer.test.tsx` を以下の完全な内容に置き換える:

```typescript
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
    opts?: { playerVars?: { list?: string; listType?: string } }
    onReady?: (e: { target: unknown }) => void
    onEnd?: () => void
    onError?: () => void
  }) => {
    ytProps.onReady = props.onReady
    ytProps.onEnd = props.onEnd
    ytProps.onError = props.onError
    props.onReady?.({ target: { playVideo: mockPlayVideo, pauseVideo: mockPauseVideo } })
    return (
      <div
        data-testid="yt-iframe"
        data-video-id={props.videoId}
        data-playlist-id={props.opts?.playerVars?.list ?? ''}
      />
    )
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

  it('videoId 変更でエラーメッセージをリセット', async () => {
    const { rerender } = render(<YouTubePlayer {...baseProps} />)
    act(() => { ytProps.onError?.() })
    expect(screen.getByRole('alert')).toBeInTheDocument()
    rerender(<YouTubePlayer {...baseProps} videoId="newVideoId" />)
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('playlistId が渡されたとき data-playlist-id が設定される', () => {
    render(
      <YouTubePlayer
        playlistId="PLxxx"
        isPlaying={false}
        onPlayToggle={vi.fn()}
        onEnded={vi.fn()}
        onPrev={vi.fn()}
        onNext={vi.fn()}
        hasPrev={false}
        hasNext={false}
      />
    )
    expect(screen.getByTestId('yt-iframe')).toHaveAttribute('data-playlist-id', 'PLxxx')
  })

  it('playlistId 変更でエラーメッセージをリセット', () => {
    const { rerender } = render(
      <YouTubePlayer
        playlistId="PLxxx"
        isPlaying={false}
        onPlayToggle={vi.fn()}
        onEnded={vi.fn()}
        onPrev={vi.fn()}
        onNext={vi.fn()}
        hasPrev={false}
        hasNext={false}
      />
    )
    act(() => { ytProps.onError?.() })
    expect(screen.getByRole('alert')).toBeInTheDocument()
    rerender(
      <YouTubePlayer
        playlistId="PLyyy"
        isPlaying={false}
        onPlayToggle={vi.fn()}
        onEnded={vi.fn()}
        onPrev={vi.fn()}
        onNext={vi.fn()}
        hasPrev={false}
        hasNext={false}
      />
    )
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})
```

- [ ] **Step 2: テストが失敗することを確認**

```bash
npx vitest run src/components/YouTubePlayer.test.tsx
```

期待: `playlistId が渡されたとき` / `playlistId 変更で` の2件がFAIL

- [ ] **Step 3: 実装を更新（Green）**

`src/components/YouTubePlayer.tsx` を以下の完全な内容に置き換える:

```typescript
import YouTube from 'react-youtube'
import { useEffect, useRef, useState } from 'react'

interface Props {
  videoId?: string
  playlistId?: string
  isPlaying: boolean
  onPlayToggle: () => void
  onEnded: () => void
  onPrev: () => void
  onNext: () => void
  hasPrev: boolean
  hasNext: boolean
}

export default function YouTubePlayer({
  videoId, playlistId, isPlaying, onPlayToggle, onEnded, onPrev, onNext, hasPrev, hasNext,
}: Props) {
  const playerRef = useRef<{ playVideo: () => void; pauseVideo: () => void } | null>(null)
  const [playerError, setPlayerError] = useState(false)

  useEffect(() => {
    setPlayerError(false)
  }, [videoId, playlistId])

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
    <div>
      <YouTube
        videoId={videoId ?? ''}
        opts={{ width: '200', height: '113', playerVars }}
        onReady={(event) => {
          playerRef.current = event.target as { playVideo: () => void; pauseVideo: () => void }
          if (isPlaying) event.target.playVideo()
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

期待: 全テスト PASS（既存12件 + 新規2件 = 14件）

- [ ] **Step 5: コミット**

```bash
git add src/components/YouTubePlayer.tsx src/components/YouTubePlayer.test.tsx
git commit -m "feat: YouTubePlayer に playlistId prop を追加"
```

---

## Task 4: `MusicPanel.tsx` をプレイリスト対応に更新

**Files:**
- Modify: `src/components/MusicPanel.tsx`
- Test: `src/components/MusicPanel.test.tsx`

- [ ] **Step 1: テストを更新・追加（Red）**

`src/components/MusicPanel.test.tsx` を以下の完全な内容に置き換える:

```typescript
import { render, screen, waitFor, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import MusicPanel from './MusicPanel'
import type { MusicLink } from '../types/session'

const { mockAddLink, mockDeleteLink, mockLinks, mockYouTubePlayer, capturedOptions } = vi.hoisted(() => ({
  mockAddLink: vi.fn(),
  mockDeleteLink: vi.fn(),
  mockLinks: { value: [] as MusicLink[] },
  mockYouTubePlayer: vi.fn(),
  capturedOptions: { onInsert: undefined as ((link: MusicLink) => void) | undefined },
}))

vi.mock('../hooks/useMusicLinks', () => ({
  useMusicLinks: (_sessionId: string, options?: { onInsert?: (link: MusicLink) => void }) => {
    capturedOptions.onInsert = options?.onInsert
    return { links: mockLinks.value, loading: false, error: null }
  },
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
const playlistLink: MusicLink = {
  id: 'ml-pl', session_id: 'sess-1', added_by_auth_id: 'uid-me',
  url: 'https://www.youtube.com/playlist?list=PLxxx', created_at: '2026-04-26T10:02:00Z',
}

describe('MusicPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockLinks.value = []
    capturedOptions.onInsert = undefined
    mockYouTubePlayer.mockImplementation(
      ({ videoId, isPlaying }: { videoId?: string; isPlaying: boolean }) => (
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

  it('プレイリスト URL の link で playlistId が YouTubePlayer に渡る', () => {
    mockLinks.value = [playlistLink]
    render(<MusicPanel sessionId="sess-1" currentUserId="uid-me" />)
    expect(mockYouTubePlayer).toHaveBeenCalledWith(
      expect.objectContaining({ playlistId: 'PLxxx', videoId: undefined }),
      expect.anything()
    )
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

  it('handleEnded で deleteLink を呼ぶ', async () => {
    mockLinks.value = [link1, link2]
    mockDeleteLink.mockResolvedValue(true)
    render(<MusicPanel sessionId="sess-1" currentUserId="uid-me" />)
    const onEnded = mockYouTubePlayer.mock.calls[0][0].onEnded as () => Promise<void>
    await act(async () => { await onEnded() })
    expect(mockDeleteLink).toHaveBeenCalledWith('ml-1')
  })

  it('handleEnded 後 links 更新で次の曲が aria-current になる', async () => {
    mockLinks.value = [link1, link2]
    mockDeleteLink.mockResolvedValue(true)
    const { rerender } = render(<MusicPanel sessionId="sess-1" currentUserId="uid-me" />)
    const onEnded = mockYouTubePlayer.mock.calls[0][0].onEnded as () => Promise<void>
    await act(async () => { await onEnded() })
    mockLinks.value = [link2]
    rerender(<MusicPanel sessionId="sess-1" currentUserId="uid-me" />)
    expect(screen.getAllByRole('listitem')[0]).toHaveAttribute('aria-current', 'true')
  })

  it('INSERT 到着（未再生）で isPlaying が true になる', () => {
    mockLinks.value = [link1]
    render(<MusicPanel sessionId="sess-1" currentUserId="uid-me" />)
    expect(mockYouTubePlayer.mock.calls.at(-1)?.[0].isPlaying).toBe(false)
    act(() => { capturedOptions.onInsert?.(link2) })
    expect(mockYouTubePlayer.mock.calls.at(-1)?.[0].isPlaying).toBe(true)
  })

  it('INSERT 到着（再生中）で isPlaying は変化しない', () => {
    mockLinks.value = [link1]
    render(<MusicPanel sessionId="sess-1" currentUserId="uid-me" />)
    const onPlayToggle = mockYouTubePlayer.mock.calls[0][0].onPlayToggle as () => void
    act(() => { onPlayToggle() })
    expect(mockYouTubePlayer.mock.calls.at(-1)?.[0].isPlaying).toBe(true)
    act(() => { capturedOptions.onInsert?.(link2) })
    expect(mockYouTubePlayer.mock.calls.at(-1)?.[0].isPlaying).toBe(true)
  })

  it('currentIndex より前のリンク削除で再生が継続する', async () => {
    const myLink1: MusicLink = { ...link1, id: 'ml-mine', added_by_auth_id: 'uid-me' }
    mockLinks.value = [myLink1, link2]
    mockDeleteLink.mockResolvedValue(true)
    const { rerender } = render(<MusicPanel sessionId="sess-1" currentUserId="uid-me" />)
    const onNext = mockYouTubePlayer.mock.calls[0][0].onNext as () => void
    act(() => { onNext() })
    const items = screen.getAllByRole('listitem')
    expect(items[1]).toHaveAttribute('aria-current', 'true')
    await userEvent.click(screen.getByRole('button', { name: '削除' }))
    expect(mockDeleteLink).toHaveBeenCalledWith('ml-mine')
    mockLinks.value = [link2]
    rerender(<MusicPanel sessionId="sess-1" currentUserId="uid-me" />)
    expect(screen.getAllByRole('listitem')[0]).toHaveAttribute('aria-current', 'true')
  })

  it('INSERT 到着時: onMusicAdd コールバックを呼ぶ', () => {
    const onMusicAdd = vi.fn()
    mockLinks.value = [link1]
    render(<MusicPanel sessionId="sess-1" currentUserId="uid-me" onMusicAdd={onMusicAdd} />)
    act(() => { capturedOptions.onInsert?.(link2) })
    expect(onMusicAdd).toHaveBeenCalledWith(link2)
  })
})
```

- [ ] **Step 2: テストが失敗することを確認**

```bash
npx vitest run src/components/MusicPanel.test.tsx
```

期待: `プレイリスト URL の link で playlistId が YouTubePlayer に渡る` がFAIL

- [ ] **Step 3: 実装を更新（Green）**

`src/components/MusicPanel.tsx` を以下の完全な内容に置き換える:

```typescript
import { useEffect, useState } from 'react'
import { useMusicLinks } from '../hooks/useMusicLinks'
import { useAddMusicLink } from '../hooks/useAddMusicLink'
import YouTubePlayer from './YouTubePlayer'
import { extractYouTubeId, extractPlaylistId } from '../utils/youtube'
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
  const playlistId = !videoId && currentLink ? extractPlaylistId(currentLink.url) : null

  return (
    <div className="flex flex-col h-full">
      <div className="bg-camp-dark px-4 py-4 flex flex-col gap-3">
        {(videoId || playlistId) ? (
          <YouTubePlayer
            key={`${currentIndex}-${restartKey}`}
            videoId={videoId ?? undefined}
            playlistId={playlistId ?? undefined}
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
            placeholder="YouTube / YouTube Music URL"
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

- [ ] **Step 4: テストが通ることを確認**

```bash
npx vitest run src/components/MusicPanel.test.tsx
```

期待: 全テスト PASS（既存14件 + 新規1件 = 15件）

- [ ] **Step 5: 全テストを実行して回帰がないことを確認**

```bash
npx vitest run
```

期待: 全テスト PASS

- [ ] **Step 6: コミット**

```bash
git add src/components/MusicPanel.tsx src/components/MusicPanel.test.tsx
git commit -m "feat: MusicPanel をプレイリスト対応に更新"
```
