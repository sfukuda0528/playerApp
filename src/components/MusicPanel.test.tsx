import { render, screen, waitFor, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import MusicPanel from './MusicPanel'
import type { MusicLink } from '../types/session'

const {
  mockAddLink, mockDeleteLink, mockLinks, mockYouTubePlayer,
  mockSearch, mockSearchResults, mockFetchTitle, mockFetchedTitle,
  mockReorder, mockOptimisticReorder, capturedOptions, capturedOnDragEnd, mockError,
} = vi.hoisted(() => ({
  mockAddLink: vi.fn(),
  mockDeleteLink: vi.fn(),
  mockLinks: { value: [] as MusicLink[] },
  mockYouTubePlayer: vi.fn(),
  mockSearch: vi.fn(),
  mockSearchResults: { value: [] as Array<{ videoId: string; title: string; thumbnail: string }> },
  mockFetchTitle: vi.fn(),
  mockFetchedTitle: { value: null as string | null },
  mockReorder: vi.fn(),
  mockOptimisticReorder: vi.fn(),
  capturedOptions: { onInsert: undefined as ((link: MusicLink, prevLinks: MusicLink[]) => void) | undefined },
  capturedOnDragEnd: { fn: undefined as ((e: unknown) => void) | undefined },
  mockError: { value: null as string | null },
}))

vi.mock('../hooks/useMusicLinks', () => ({
  useMusicLinks: (_sessionId: string, options?: { onInsert?: (link: MusicLink, prevLinks: MusicLink[]) => void }) => {
    capturedOptions.onInsert = options?.onInsert
    return { links: mockLinks.value, loading: false, error: null, optimisticReorder: mockOptimisticReorder }
  },
}))

vi.mock('../hooks/useAddMusicLink', () => ({
  useAddMusicLink: () => ({
    addLink: mockAddLink,
    deleteLink: mockDeleteLink,
    loading: false,
    error: mockError.value,
  }),
}))

vi.mock('../hooks/useReorderMusicLink', () => ({
  useReorderMusicLink: () => ({ reorder: mockReorder }),
}))

vi.mock('../hooks/useYouTubeSearch', () => ({
  useYouTubeSearch: () => ({
    results: mockSearchResults.value,
    loading: false,
    error: null,
    search: mockSearch,
    clear: vi.fn(),
  }),
}))

vi.mock('../hooks/useYouTubeVideoTitle', () => ({
  useYouTubeVideoTitle: () => ({
    title: mockFetchedTitle.value,
    loading: false,
    fetchTitle: mockFetchTitle,
    clear: vi.fn(),
  }),
}))

vi.mock('./YouTubePlayer', () => ({
  default: mockYouTubePlayer,
}))

vi.mock('@dnd-kit/core', () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  DndContext: ({ children, onDragEnd }: any) => {
    capturedOnDragEnd.fn = onDragEnd
    return children
  },
  closestCenter: vi.fn(),
  PointerSensor: class {},
  useSensor: vi.fn(),
  useSensors: vi.fn(() => []),
}))

vi.mock('@dnd-kit/sortable', () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  SortableContext: ({ children }: any) => children,
  verticalListSortingStrategy: {},
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  useSortable: (_args: any) => ({
    attributes: {},
    listeners: {},
    setNodeRef: vi.fn(),
    transform: null,
    transition: null,
    isDragging: false,
  }),
  arrayMove: (arr: MusicLink[], from: number, to: number) => {
    const result = [...arr]
    result.splice(to, 0, result.splice(from, 1)[0])
    return result
  },
}))

vi.mock('@dnd-kit/utilities', () => ({
  CSS: { Transform: { toString: () => '' } },
}))

const link1: MusicLink = {
  id: 'ml-1', session_id: 'sess-1', added_by_auth_id: 'uid-me',
  url: 'https://youtu.be/dQw4w9WgXcQ', title: 'Never Gonna Give You Up',
  sort_order: 1000, created_at: '2026-04-26T10:00:00Z',
}
const link2: MusicLink = {
  id: 'ml-2', session_id: 'sess-1', added_by_auth_id: 'uid-other',
  url: 'https://youtu.be/abc1234', title: '別の動画',
  sort_order: 2000, created_at: '2026-04-26T10:01:00Z',
}
const playlistLink: MusicLink = {
  id: 'ml-pl', session_id: 'sess-1', added_by_auth_id: 'uid-me',
  url: 'https://www.youtube.com/playlist?list=PLxxx', title: 'プレイリスト',
  sort_order: 3000, created_at: '2026-04-26T10:02:00Z',
}

describe('MusicPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockLinks.value = []
    mockSearchResults.value = []
    mockFetchedTitle.value = null
    mockError.value = null
    capturedOptions.onInsert = undefined
    capturedOnDragEnd.fn = undefined
    mockYouTubePlayer.mockImplementation(
      ({ videoId, isPlaying }: { videoId?: string; isPlaying: boolean }) => (
        <div data-testid="youtube-player" data-video-id={videoId} data-playing={String(isPlaying)} />
      )
    )
    mockAddLink.mockResolvedValue(true)
    mockDeleteLink.mockResolvedValue(true)
    mockReorder.mockResolvedValue(true)
  })

  describe('キュー表示', () => {
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
        undefined
      )
    })

    it('キューにタイトルを表示する（URL ではなく）', () => {
      mockLinks.value = [link1]
      render(<MusicPanel sessionId="sess-1" currentUserId="uid-me" />)
      expect(screen.getByText('Never Gonna Give You Up')).toBeInTheDocument()
      expect(screen.queryByText(link1.url)).not.toBeInTheDocument()
    })

    it('キューアイテムにドラッグハンドルが表示される', () => {
      mockLinks.value = [link1]
      render(<MusicPanel sessionId="sess-1" currentUserId="uid-me" />)
      expect(screen.getByRole('button', { name: '並び替え' })).toBeInTheDocument()
    })

    it('先頭リンクに aria-current が付与される', () => {
      mockLinks.value = [link1, link2]
      render(<MusicPanel sessionId="sess-1" currentUserId="uid-me" />)
      const items = screen.getAllByRole('listitem')
      expect(items[0]).toHaveAttribute('aria-current', 'true')
      expect(items[1]).not.toHaveAttribute('aria-current', 'true')
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
      render(<MusicPanel sessionId="sess-1" currentUserId="uid-me" />)
      await userEvent.click(screen.getByRole('button', { name: '削除' }))
      expect(mockDeleteLink).toHaveBeenCalledWith('ml-1')
    })
  })

  describe('ドラッグ並び替え', () => {
    it('onDragEnd 発火で reorder を呼ぶ', async () => {
      mockLinks.value = [link1, link2]
      render(<MusicPanel sessionId="sess-1" currentUserId="uid-me" />)

      await act(async () => {
        capturedOnDragEnd.fn?.({ active: { id: 'ml-1' }, over: { id: 'ml-2' } })
      })

      await waitFor(() => expect(mockReorder).toHaveBeenCalledOnce())
      expect(mockReorder).toHaveBeenCalledWith('ml-1', expect.any(Number))
    })

    it('active と over が同じとき reorder を呼ばない', async () => {
      mockLinks.value = [link1, link2]
      render(<MusicPanel sessionId="sess-1" currentUserId="uid-me" />)

      await act(async () => {
        capturedOnDragEnd.fn?.({ active: { id: 'ml-1' }, over: { id: 'ml-1' } })
      })

      expect(mockReorder).not.toHaveBeenCalled()
    })

    it('onDragEnd 発火で optimisticReorder を呼ぶ（楽観的更新）', async () => {
      mockLinks.value = [link1, link2]
      render(<MusicPanel sessionId="sess-1" currentUserId="uid-me" />)

      await act(async () => {
        capturedOnDragEnd.fn?.({ active: { id: 'ml-2' }, over: { id: 'ml-1' } })
      })

      expect(mockOptimisticReorder).toHaveBeenCalledOnce()
      expect(mockOptimisticReorder).toHaveBeenCalledWith([link2, link1])
    })
  })

  describe('検索タブ（デフォルト）', () => {
    it('初期表示で検索タブが表示される', () => {
      render(<MusicPanel sessionId="sess-1" currentUserId="uid-me" />)
      expect(screen.getByPlaceholderText('曲名・アーティスト名で検索')).toBeInTheDocument()
    })

    it('検索ボタンクリックで search を呼ぶ', async () => {
      render(<MusicPanel sessionId="sess-1" currentUserId="uid-me" />)
      await userEvent.type(screen.getByPlaceholderText('曲名・アーティスト名で検索'), 'テスト')
      await userEvent.click(screen.getByRole('button', { name: '🔍' }))
      expect(mockSearch).toHaveBeenCalledWith('テスト')
    })

    it('Enterキーで search を呼ぶ', async () => {
      render(<MusicPanel sessionId="sess-1" currentUserId="uid-me" />)
      await userEvent.type(screen.getByPlaceholderText('曲名・アーティスト名で検索'), 'テスト{Enter}')
      expect(mockSearch).toHaveBeenCalledWith('テスト')
    })

    it('検索結果にサムネイルとタイトルを表示する', () => {
      mockSearchResults.value = [
        { videoId: 'vid-1', title: '検索結果動画', thumbnail: 'https://example.com/thumb.jpg' },
      ]
      render(<MusicPanel sessionId="sess-1" currentUserId="uid-me" />)
      expect(screen.getByText('検索結果動画')).toBeInTheDocument()
      expect(screen.getByRole('img')).toHaveAttribute('src', 'https://example.com/thumb.jpg')
    })

    it('検索結果の「先頭に追加」ボタンで addLink を position=head で呼ぶ', async () => {
      mockSearchResults.value = [
        { videoId: 'vid-1', title: '検索結果動画', thumbnail: '' },
      ]
      render(<MusicPanel sessionId="sess-1" currentUserId="uid-me" />)
      await userEvent.click(screen.getByRole('button', { name: '検索結果動画を先頭に追加' }))
      expect(mockAddLink).toHaveBeenCalledWith(
        'sess-1',
        'https://www.youtube.com/watch?v=vid-1',
        '検索結果動画',
        'head'
      )
    })

    it('検索結果の「末尾に追加」ボタンで addLink を position=tail で呼ぶ', async () => {
      mockSearchResults.value = [
        { videoId: 'vid-1', title: '検索結果動画', thumbnail: '' },
      ]
      render(<MusicPanel sessionId="sess-1" currentUserId="uid-me" />)
      await userEvent.click(screen.getByRole('button', { name: '検索結果動画を末尾に追加' }))
      expect(mockAddLink).toHaveBeenCalledWith(
        'sess-1',
        'https://www.youtube.com/watch?v=vid-1',
        '検索結果動画',
        'tail'
      )
    })

    it('addLink 失敗時に error を表示する', async () => {
      mockSearchResults.value = [
        { videoId: 'vid-1', title: '検索結果動画', thumbnail: '' },
      ]
      mockAddLink.mockImplementation(async () => {
        mockError.value = '追加に失敗しました'
        return false
      })
      const { rerender } = render(<MusicPanel sessionId="sess-1" currentUserId="uid-me" />)
      await userEvent.click(screen.getByRole('button', { name: '検索結果動画を先頭に追加' }))
      rerender(<MusicPanel sessionId="sess-1" currentUserId="uid-me" />)
      await waitFor(() =>
        expect(screen.getByRole('alert')).toHaveTextContent('追加に失敗しました')
      )
    })
  })

  describe('URL入力タブ', () => {
    const switchToUrlTab = async () => {
      await userEvent.click(screen.getByRole('tab', { name: 'URL入力' }))
    }

    it('URL入力 タブに切り替え可能', async () => {
      render(<MusicPanel sessionId="sess-1" currentUserId="uid-me" />)
      await switchToUrlTab()
      expect(screen.getByPlaceholderText('YouTube / YouTube Music URL')).toBeInTheDocument()
    })

    it('URL入力欄のblurで fetchTitle を呼ぶ', async () => {
      render(<MusicPanel sessionId="sess-1" currentUserId="uid-me" />)
      await switchToUrlTab()
      const input = screen.getByPlaceholderText('YouTube / YouTube Music URL')
      await userEvent.type(input, 'https://youtu.be/abc')
      await userEvent.tab()
      expect(mockFetchTitle).toHaveBeenCalledWith('https://youtu.be/abc')
    })

    it('取得済みタイトルを表示する', async () => {
      mockFetchedTitle.value = '取得されたタイトル'
      render(<MusicPanel sessionId="sess-1" currentUserId="uid-me" />)
      await switchToUrlTab()
      expect(screen.getByText(/取得されたタイトル/)).toBeInTheDocument()
    })

    it('「先頭に追加」クリックで addLink を position=head で呼ぶ', async () => {
      render(<MusicPanel sessionId="sess-1" currentUserId="uid-me" />)
      await switchToUrlTab()
      await userEvent.type(
        screen.getByPlaceholderText('YouTube / YouTube Music URL'),
        'https://youtu.be/abc'
      )
      await userEvent.click(screen.getByRole('button', { name: '先頭に追加' }))
      expect(mockAddLink).toHaveBeenCalledWith(
        'sess-1', 'https://youtu.be/abc', expect.any(String), 'head'
      )
    })

    it('「末尾に追加」クリックで addLink を position=tail で呼ぶ', async () => {
      render(<MusicPanel sessionId="sess-1" currentUserId="uid-me" />)
      await switchToUrlTab()
      await userEvent.type(
        screen.getByPlaceholderText('YouTube / YouTube Music URL'),
        'https://youtu.be/abc'
      )
      await userEvent.click(screen.getByRole('button', { name: '末尾に追加' }))
      expect(mockAddLink).toHaveBeenCalledWith(
        'sess-1', 'https://youtu.be/abc', expect.any(String), 'tail'
      )
    })

    it('追加成功後: URL入力フィールドがクリアされる', async () => {
      render(<MusicPanel sessionId="sess-1" currentUserId="uid-me" />)
      await switchToUrlTab()
      const input = screen.getByPlaceholderText('YouTube / YouTube Music URL')
      await userEvent.type(input, 'https://youtu.be/abc')
      await userEvent.click(screen.getByRole('button', { name: '末尾に追加' }))
      await waitFor(() => expect(input).toHaveValue(''))
    })
  })

  describe('再生状態', () => {
    it('handleEnded で deleteLink を呼ぶ', async () => {
      mockLinks.value = [link1, link2]
      render(<MusicPanel sessionId="sess-1" currentUserId="uid-me" />)
      const onEnded = mockYouTubePlayer.mock.calls[0][0].onEnded as () => Promise<void>
      await act(async () => { await onEnded() })
      expect(mockDeleteLink).toHaveBeenCalledWith('ml-1')
    })

    it('handleEnded 後 links 更新で次の曲が aria-current になる', async () => {
      mockLinks.value = [link1, link2]
      const { rerender } = render(<MusicPanel sessionId="sess-1" currentUserId="uid-me" />)
      const onEnded = mockYouTubePlayer.mock.calls[0][0].onEnded as () => Promise<void>
      await act(async () => { await onEnded() })
      mockLinks.value = [link2]
      rerender(<MusicPanel sessionId="sess-1" currentUserId="uid-me" />)
      expect(screen.getAllByRole('listitem')[0]).toHaveAttribute('aria-current', 'true')
    })

    it('空キューに最初の曲が INSERT されたとき isPlaying が true になる', () => {
      mockLinks.value = []
      render(<MusicPanel sessionId="sess-1" currentUserId="uid-me" />)
      mockLinks.value = [link1]
      act(() => { capturedOptions.onInsert?.(link1, []) })
      expect(mockYouTubePlayer.mock.calls.at(-1)?.[0].isPlaying).toBe(true)
    })

    it('INSERT 到着（未再生）で isPlaying が true になる', () => {
      mockLinks.value = [link1]
      render(<MusicPanel sessionId="sess-1" currentUserId="uid-me" />)
      expect(mockYouTubePlayer.mock.calls.at(-1)?.[0].isPlaying).toBe(false)
      act(() => { capturedOptions.onInsert?.(link2, [link1]) })
      expect(mockYouTubePlayer.mock.calls.at(-1)?.[0].isPlaying).toBe(true)
    })

    it('INSERT 到着時: onMusicAdd コールバックを呼ぶ', () => {
      const onMusicAdd = vi.fn()
      mockLinks.value = [link1]
      render(<MusicPanel sessionId="sess-1" currentUserId="uid-me" onMusicAdd={onMusicAdd} />)
      act(() => { capturedOptions.onInsert?.(link2, [link1]) })
      expect(onMusicAdd).toHaveBeenCalledWith(link2)
    })

    it('先頭に INSERT されたとき currentIndex が +1 される（再生中の曲が変わらない）', () => {
      const newLink: MusicLink = {
        id: 'ml-new', session_id: 'sess-1', added_by_auth_id: 'uid-other',
        url: 'https://youtu.be/new', title: '先頭に追加される曲',
        sort_order: 0, created_at: '2026-04-26T10:02:00Z',
      }
      mockLinks.value = [link1, link2]
      render(<MusicPanel sessionId="sess-1" currentUserId="uid-me" />)
      // 初期状態: currentIndex=0, link1 が再生中
      expect(screen.getAllByRole('listitem')[0]).toHaveAttribute('aria-current', 'true')

      // newLink が先頭（sort_order=0）に挿入される
      // prevLinks=[link1, link2], newLink を先頭に追加 → insertedAt=0 → currentIndex: 0→1
      act(() => { capturedOptions.onInsert?.(newLink, [link1, link2]) })

      // links も先頭にnewLinkが追加された状態に更新
      mockLinks.value = [newLink, link1, link2]
      const { rerender } = render(<MusicPanel sessionId="sess-1" currentUserId="uid-me" />)
      rerender(<MusicPanel sessionId="sess-1" currentUserId="uid-me" />)

      // currentIndex=1 になっているので link1（index=1）が aria-current
      const items = screen.getAllByRole('listitem')
      expect(items[1]).toHaveAttribute('aria-current', 'true')
    })
  })
})
