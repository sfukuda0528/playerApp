import { render, screen, waitFor, act, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import MusicPanel from './MusicPanel'
import type { MusicLink, MusicPlaybackState } from '../types/session'

const {
  mockAddLink, mockDeleteLink, mockLinks, mockYouTubePlayer,
  mockSearch, mockSearchResults, mockFetchTitle, mockFetchedTitle,
  mockReorder, mockOptimisticReorder, mockOptimisticDelete, capturedOptions, capturedOnDragEnd, mockError,
  mockAddLinks, mockFetchPlaylistItems, mockPlaylistError,
  mockAmbientPlayer, mockPlaybackState, mockPlaybackError, mockSetCurrent, mockSetPlaying,
} = vi.hoisted(() => ({
  mockAddLink: vi.fn(),
  mockDeleteLink: vi.fn(),
  mockLinks: { value: [] as MusicLink[] },
  mockYouTubePlayer: vi.fn(),
  mockSearch: vi.fn(),
  mockSearchResults: { value: [] as Array<{ videoId: string; title: string; thumbnail: string; channelTitle?: string }> },
  mockFetchTitle: vi.fn(),
  mockFetchedTitle: { value: null as string | null },
  mockReorder: vi.fn(),
  mockOptimisticReorder: vi.fn(),
  mockOptimisticDelete: vi.fn(),
  capturedOptions: { onInsert: undefined as ((link: MusicLink, prevLinks: MusicLink[]) => void) | undefined },
  capturedOnDragEnd: { fn: undefined as ((e: unknown) => void) | undefined },
  mockError: { value: null as string | null },
  mockAddLinks: vi.fn(),
  mockFetchPlaylistItems: vi.fn(),
  mockPlaylistError: { value: null as string | null },
  mockAmbientPlayer: vi.fn(),
  mockPlaybackState: { value: null as MusicPlaybackState | null },
  mockPlaybackError: { value: null as string | null },
  mockSetCurrent: vi.fn(),
  mockSetPlaying: vi.fn(),
}))

vi.mock('../hooks/useMusicLinks', () => ({
  useMusicLinks: (_sessionId: string, options?: { onInsert?: (link: MusicLink, prevLinks: MusicLink[]) => void }) => {
    capturedOptions.onInsert = options?.onInsert
    return {
      links: mockLinks.value,
      loading: false,
      error: null,
      optimisticReorder: mockOptimisticReorder,
      optimisticDelete: mockOptimisticDelete,
    }
  },
}))

vi.mock('../hooks/useAddMusicLink', () => ({
  useAddMusicLink: () => ({
    addLink: mockAddLink,
    addLinks: mockAddLinks,
    deleteLink: mockDeleteLink,
    loading: false,
    error: mockError.value,
  }),
}))

vi.mock('../hooks/useReorderMusicLink', () => ({
  useReorderMusicLink: () => ({ reorder: mockReorder }),
}))

vi.mock('../hooks/useMusicPlaybackState', () => ({
  useMusicPlaybackState: () => ({
    state: mockPlaybackState.value,
    loading: false,
    error: mockPlaybackError.value,
    setCurrent: mockSetCurrent,
    setPlaying: mockSetPlaying,
  }),
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

vi.mock('./AmbientPlayer', () => ({
  default: mockAmbientPlayer,
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

vi.mock('../hooks/usePlaylistItems', () => ({
  usePlaylistItems: () => ({
    fetchPlaylistItems: mockFetchPlaylistItems,
    error: mockPlaylistError.value,
  }),
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

function playbackState(currentMusicLinkId: string | null, isPlaying = false): MusicPlaybackState {
  return {
    session_id: 'sess-1',
    current_music_link_id: currentMusicLinkId,
    is_playing: isPlaying,
    updated_by_auth_id: 'uid-host',
    updated_at: '2026-05-13T00:00:00Z',
  }
}

describe('MusicPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockLinks.value = []
    mockSearchResults.value = []
    mockFetchedTitle.value = null
    mockError.value = null
    mockPlaybackState.value = null
    mockPlaybackError.value = null
    capturedOptions.onInsert = undefined
    capturedOnDragEnd.fn = undefined
    mockAddLinks.mockResolvedValue(true)
    mockFetchPlaylistItems.mockResolvedValue([])
    mockPlaylistError.value = null
    mockYouTubePlayer.mockImplementation(
      ({ videoId, isPlaying }: { videoId?: string; isPlaying: boolean }) => (
        <div data-testid="youtube-player" data-video-id={videoId} data-playing={String(isPlaying)} />
      )
    )
    mockAmbientPlayer.mockImplementation(({ videoId }: { videoId: string }) => (
      <div data-testid="ambient-player" data-video-id={videoId} />
    ))
    mockAddLink.mockResolvedValue(true)
    mockDeleteLink.mockResolvedValue(true)
    mockReorder.mockResolvedValue(true)
    mockSetCurrent.mockResolvedValue(true)
    mockSetPlaying.mockResolvedValue(true)
  })

  describe('キュー表示', () => {
    it('links が空のとき YouTubePlayer は表示されない', () => {
      render(<MusicPanel sessionId="sess-1" currentUserId="uid-me" isHost={true} />)
      expect(screen.queryByTestId('youtube-player')).not.toBeInTheDocument()
    })

    it('links があるとき YouTubePlayer に videoId が渡る', () => {
      mockLinks.value = [link1]
      mockPlaybackState.value = playbackState('ml-1')
      render(<MusicPanel sessionId="sess-1" currentUserId="uid-me" isHost={true} />)
      expect(screen.getByTestId('youtube-player')).toHaveAttribute('data-video-id', 'dQw4w9WgXcQ')
    })

    it('プレイリスト URL の link で playlistId が YouTubePlayer に渡る', () => {
      mockLinks.value = [playlistLink]
      mockPlaybackState.value = playbackState('ml-pl')
      render(<MusicPanel sessionId="sess-1" currentUserId="uid-me" isHost={true} />)
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
      mockPlaybackState.value = playbackState('ml-1')
      render(<MusicPanel sessionId="sess-1" currentUserId="uid-me" />)
      const items = screen.getAllByRole('listitem')
      expect(items[0]).toHaveAttribute('aria-current', 'true')
      expect(items[1]).not.toHaveAttribute('aria-current', 'true')
    })

    it('playback state の current_music_link_id の曲に aria-current が付与される', () => {
      mockLinks.value = [link1, link2]
      mockPlaybackState.value = playbackState('ml-2', true)
      render(<MusicPanel sessionId="sess-1" currentUserId="uid-me" isHost={true} />)
      const items = screen.getAllByRole('listitem')
      expect(items[0]).not.toHaveAttribute('aria-current', 'true')
      expect(items[1]).toHaveAttribute('aria-current', 'true')
      expect(screen.getByTestId('youtube-player')).toHaveAttribute('data-video-id', 'abc1234')
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

    it('ホストには他人のリンクにも削除ボタンが表示される', () => {
      mockLinks.value = [link2]
      render(<MusicPanel sessionId="sess-1" currentUserId="uid-me" isHost={true} />)
      expect(screen.getByRole('button', { name: '削除' })).toBeInTheDocument()
    })

    it('削除ボタンクリックで deleteLink を呼ぶ', async () => {
      mockLinks.value = [link1]
      render(<MusicPanel sessionId="sess-1" currentUserId="uid-me" />)
      await userEvent.click(screen.getByRole('button', { name: '削除' }))
      expect(mockDeleteLink).toHaveBeenCalledWith('ml-1')
    })

    it('isHost=true かつ links が空のとき AmbientPlayer が表示される', () => {
      render(<MusicPanel sessionId="sess-1" currentUserId="uid-me" isHost={true} />)
      expect(screen.getByTestId('ambient-player')).toBeInTheDocument()
    })

    it('isHost=true かつ links があるとき AmbientPlayer は表示されない', () => {
      mockLinks.value = [link1]
      render(<MusicPanel sessionId="sess-1" currentUserId="uid-me" isHost={true} />)
      expect(screen.queryByTestId('ambient-player')).not.toBeInTheDocument()
    })

    it('isHost=false かつ links が空のとき AmbientPlayer は表示されない', () => {
      render(<MusicPanel sessionId="sess-1" currentUserId="uid-me" isHost={false} />)
      expect(screen.queryByTestId('ambient-player')).not.toBeInTheDocument()
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
      await userEvent.click(screen.getByRole('button', { name: '検索' }))
      expect(mockSearch).toHaveBeenCalledWith('テスト')
    })

    it('Enterキーで search を呼ぶ', async () => {
      render(<MusicPanel sessionId="sess-1" currentUserId="uid-me" />)
      await userEvent.type(screen.getByPlaceholderText('曲名・アーティスト名で検索'), 'テスト{Enter}')
      expect(mockSearch).toHaveBeenCalledWith('テスト')
    })

    it('検索欄の全削除ボタンで入力をクリアする', async () => {
      render(<MusicPanel sessionId="sess-1" currentUserId="uid-me" />)
      const input = screen.getByPlaceholderText('曲名・アーティスト名で検索')
      await userEvent.type(input, 'テスト')

      await userEvent.click(screen.getByRole('button', { name: '検索欄をクリア' }))

      expect(input).toHaveValue('')
    })

    it('検索結果にサムネイルとタイトルを表示する', () => {
      mockSearchResults.value = [
        { videoId: 'vid-1', title: '検索結果動画', thumbnail: 'https://example.com/thumb.jpg' },
      ]
      render(<MusicPanel sessionId="sess-1" currentUserId="uid-me" />)
      expect(screen.getByText('検索結果動画')).toBeInTheDocument()
      expect(screen.getByRole('img')).toHaveAttribute('src', 'https://example.com/thumb.jpg')
    })

    it('検索結果の「次に再生」ボタンで addLink を position=head で呼ぶ', async () => {
      mockSearchResults.value = [
        { videoId: 'vid-1', title: '検索結果動画', thumbnail: '' },
      ]
      render(<MusicPanel sessionId="sess-1" currentUserId="uid-me" />)
      await userEvent.click(screen.getByRole('button', { name: '検索結果動画を次に再生' }))
      expect(mockAddLink).toHaveBeenCalledWith(
        'sess-1',
        'https://www.youtube.com/watch?v=vid-1',
        '検索結果動画',
        'head'
      )
    })

    it('検索結果の「キューに追加」ボタンで addLink を position=tail で呼ぶ', async () => {
      mockSearchResults.value = [
        { videoId: 'vid-1', title: '検索結果動画', thumbnail: '' },
      ]
      render(<MusicPanel sessionId="sess-1" currentUserId="uid-me" />)
      await userEvent.click(screen.getByRole('button', { name: '検索結果動画をキューに追加' }))
      expect(mockAddLink).toHaveBeenCalledWith(
        'sess-1',
        'https://www.youtube.com/watch?v=vid-1',
        '検索結果動画',
        'tail'
      )
    })

    it('検索結果のモバイル用＋ボタンを押すと動画情報付きダイアログを表示する', async () => {
      mockSearchResults.value = [
        { videoId: 'vid-1', title: '検索結果動画', thumbnail: 'https://example.com/thumb.jpg', channelTitle: '検索チャンネル' },
      ]
      render(<MusicPanel sessionId="sess-1" currentUserId="uid-me" />)
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

      await userEvent.click(screen.getByRole('button', { name: '検索結果動画の追加方法を表示' }))

      const dialog = screen.getByRole('dialog')
      expect(dialog).toHaveTextContent('検索結果動画')
      expect(dialog).toHaveTextContent('検索チャンネル')
      expect(dialog).toHaveTextContent('次に再生')
      expect(dialog).toHaveTextContent('キューに追加')
      expect(within(dialog).getByRole('img', { name: '検索結果動画' })).toHaveAttribute('src', 'https://example.com/thumb.jpg')
    })

    it('検索結果のモバイル用ダイアログから次に再生へ追加できる', async () => {
      mockSearchResults.value = [
        { videoId: 'vid-1', title: '検索結果動画', thumbnail: '', channelTitle: '検索チャンネル' },
      ]
      render(<MusicPanel sessionId="sess-1" currentUserId="uid-me" />)
      await userEvent.click(screen.getByRole('button', { name: '検索結果動画の追加方法を表示' }))

      await userEvent.click(screen.getByRole('button', { name: '検索結果動画を次に再生（ダイアログ）' }))

      expect(mockAddLink).toHaveBeenCalledWith(
        'sess-1',
        'https://www.youtube.com/watch?v=vid-1',
        '検索結果動画',
        'head'
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
      await userEvent.click(screen.getByRole('button', { name: '検索結果動画を次に再生' }))
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

    it('URL入力欄の全削除ボタンで入力をクリアする', async () => {
      render(<MusicPanel sessionId="sess-1" currentUserId="uid-me" />)
      await switchToUrlTab()
      const input = screen.getByPlaceholderText('YouTube / YouTube Music URL')
      await userEvent.type(input, 'https://youtu.be/abc')

      await userEvent.click(screen.getByRole('button', { name: 'URL入力欄をクリア' }))

      expect(input).toHaveValue('')
    })

    it('取得済みタイトルを表示する', async () => {
      mockFetchedTitle.value = '取得されたタイトル'
      render(<MusicPanel sessionId="sess-1" currentUserId="uid-me" />)
      await switchToUrlTab()
      expect(screen.getByText(/取得されたタイトル/)).toBeInTheDocument()
    })

    it('「次に再生」クリックで addLink を position=head で呼ぶ', async () => {
      render(<MusicPanel sessionId="sess-1" currentUserId="uid-me" />)
      await switchToUrlTab()
      await userEvent.type(
        screen.getByPlaceholderText('YouTube / YouTube Music URL'),
        'https://youtu.be/abc'
      )
      await userEvent.click(screen.getByRole('button', { name: '次に再生' }))
      expect(mockAddLink).toHaveBeenCalledWith(
        'sess-1', 'https://youtu.be/abc', expect.any(String), 'head'
      )
    })

    it('「キューに追加」クリックで addLink を position=tail で呼ぶ', async () => {
      render(<MusicPanel sessionId="sess-1" currentUserId="uid-me" />)
      await switchToUrlTab()
      await userEvent.type(
        screen.getByPlaceholderText('YouTube / YouTube Music URL'),
        'https://youtu.be/abc'
      )
      await userEvent.click(screen.getByRole('button', { name: 'キューに追加' }))
      expect(mockAddLink).toHaveBeenCalledWith(
        'sess-1', 'https://youtu.be/abc', expect.any(String), 'tail'
      )
    })

    it('追加成功後: URL入力フィールドがクリアされる', async () => {
      render(<MusicPanel sessionId="sess-1" currentUserId="uid-me" />)
      await switchToUrlTab()
      const input = screen.getByPlaceholderText('YouTube / YouTube Music URL')
      await userEvent.type(input, 'https://youtu.be/abc')
      await userEvent.click(screen.getByRole('button', { name: 'キューに追加' }))
      await waitFor(() => expect(input).toHaveValue(''))
    })
  })

  describe('URL入力タブ - プレイリスト対応', () => {
    const switchToUrlTab = async () => {
      await userEvent.click(screen.getByRole('tab', { name: 'URL入力' }))
    }

    it('プレイリストURLでキューに追加: fetchPlaylistItems を呼び addLinks を呼ぶ（addLink は呼ばない）', async () => {
      mockFetchPlaylistItems.mockResolvedValue([
        { videoId: 'vid-1', title: '動画1' },
        { videoId: 'vid-2', title: '動画2' },
      ])
      render(<MusicPanel sessionId="sess-1" currentUserId="uid-me" />)
      await switchToUrlTab()
      await userEvent.type(
        screen.getByPlaceholderText('YouTube / YouTube Music URL'),
        'https://www.youtube.com/playlist?list=PLxxx'
      )
      await userEvent.click(screen.getByRole('button', { name: 'キューに追加' }))
      await waitFor(() => expect(mockFetchPlaylistItems).toHaveBeenCalledWith('PLxxx'))
      expect(mockAddLinks).toHaveBeenCalledWith(
        'sess-1',
        [
          { url: 'https://www.youtube.com/watch?v=vid-1', title: '動画1' },
          { url: 'https://www.youtube.com/watch?v=vid-2', title: '動画2' },
        ],
        'tail',
        undefined,
        undefined
      )
      expect(mockAddLink).not.toHaveBeenCalled()
    })

    it('プレイリスト取得中に「プレイリスト取得中...」を表示する', async () => {
      let resolveItems!: (v: { videoId: string; title: string }[]) => void
      mockFetchPlaylistItems.mockReturnValue(
        new Promise(resolve => { resolveItems = resolve })
      )
      render(<MusicPanel sessionId="sess-1" currentUserId="uid-me" />)
      await switchToUrlTab()
      await userEvent.type(
        screen.getByPlaceholderText('YouTube / YouTube Music URL'),
        'https://www.youtube.com/playlist?list=PLxxx'
      )
      act(() => { void userEvent.click(screen.getByRole('button', { name: 'キューに追加' })) })
      await waitFor(() =>
        expect(screen.getByText('プレイリスト取得中...')).toBeInTheDocument()
      )
      await act(async () => { resolveItems([]) })
    })

    it('プレイリスト追加中に「N件をキューに追加中...」を表示する', async () => {
      mockFetchPlaylistItems.mockResolvedValue([
        { videoId: 'vid-1', title: '動画1' },
        { videoId: 'vid-2', title: '動画2' },
      ])
      let resolveLinks!: (v: boolean) => void
      mockAddLinks.mockReturnValue(new Promise(resolve => { resolveLinks = resolve }))
      render(<MusicPanel sessionId="sess-1" currentUserId="uid-me" />)
      await switchToUrlTab()
      await userEvent.type(
        screen.getByPlaceholderText('YouTube / YouTube Music URL'),
        'https://www.youtube.com/playlist?list=PLxxx'
      )
      act(() => { void userEvent.click(screen.getByRole('button', { name: 'キューに追加' })) })
      await waitFor(() =>
        expect(screen.getByText('2件をキューに追加中...')).toBeInTheDocument()
      )
      await act(async () => { resolveLinks(true) })
    })

    it('プレイリスト追加成功後: URL入力フィールドがクリアされる', async () => {
      mockFetchPlaylistItems.mockResolvedValue([{ videoId: 'vid-1', title: '動画1' }])
      render(<MusicPanel sessionId="sess-1" currentUserId="uid-me" />)
      await switchToUrlTab()
      const input = screen.getByPlaceholderText('YouTube / YouTube Music URL')
      await userEvent.type(input, 'https://www.youtube.com/playlist?list=PLxxx')
      await userEvent.click(screen.getByRole('button', { name: 'キューに追加' }))
      await waitFor(() => expect(input).toHaveValue(''))
    })

    it('プレイリストが空のとき error を表示する', async () => {
      mockFetchPlaylistItems.mockImplementation(async () => {
        mockPlaylistError.value = 'プレイリストに動画がありません'
        return null
      })
      const { rerender } = render(<MusicPanel sessionId="sess-1" currentUserId="uid-me" />)
      await switchToUrlTab()
      await userEvent.type(
        screen.getByPlaceholderText('YouTube / YouTube Music URL'),
        'https://www.youtube.com/playlist?list=PLxxx'
      )
      await userEvent.click(screen.getByRole('button', { name: 'キューに追加' }))
      rerender(<MusicPanel sessionId="sess-1" currentUserId="uid-me" />)
      await waitFor(() =>
        expect(screen.getByRole('alert')).toHaveTextContent('プレイリストに動画がありません')
      )
    })

    it('watch?v=xxx&list=yyy は addLink を呼ぶ（プレイリスト展開しない）', async () => {
      render(<MusicPanel sessionId="sess-1" currentUserId="uid-me" />)
      await switchToUrlTab()
      await userEvent.type(
        screen.getByPlaceholderText('YouTube / YouTube Music URL'),
        'https://www.youtube.com/watch?v=abc&list=PLxxx'
      )
      await userEvent.click(screen.getByRole('button', { name: 'キューに追加' }))
      await waitFor(() => expect(mockAddLink).toHaveBeenCalled())
      expect(mockFetchPlaylistItems).not.toHaveBeenCalled()
    })
  })

  describe('再生状態', () => {
    afterEach(() => {
      vi.useRealTimers()
    })

    it('handleEnded で deleteLink を呼ぶ', async () => {
      mockLinks.value = [link1, link2]
      mockPlaybackState.value = playbackState('ml-1', true)
      render(<MusicPanel sessionId="sess-1" currentUserId="uid-me" isHost={true} />)
      const onEnded = mockYouTubePlayer.mock.calls[0][0].onEnded as () => Promise<void>
      await act(async () => { await onEnded() })
      expect(mockSetCurrent).toHaveBeenCalledWith('ml-2', true)
      expect(mockDeleteLink).toHaveBeenCalledWith('ml-1')
    })

    it('handleEnded は削除成功後にキューから即時除去する', async () => {
      mockLinks.value = [link1, link2]
      mockPlaybackState.value = playbackState('ml-1', true)
      render(<MusicPanel sessionId="sess-1" currentUserId="uid-me" isHost={true} />)
      const onEnded = mockYouTubePlayer.mock.calls[0][0].onEnded as () => Promise<void>

      await act(async () => { await onEnded() })

      expect(mockOptimisticDelete).toHaveBeenCalledWith('ml-1')
    })

    it('handleEnded 後 links 更新で次の曲が aria-current になる', async () => {
      mockLinks.value = [link1, link2]
      mockPlaybackState.value = playbackState('ml-1', true)
      const { rerender } = render(<MusicPanel sessionId="sess-1" currentUserId="uid-me" isHost={true} />)
      const onEnded = mockYouTubePlayer.mock.calls[0][0].onEnded as () => Promise<void>
      await act(async () => { await onEnded() })
      mockLinks.value = [link2]
      mockPlaybackState.value = playbackState('ml-2', true)
      rerender(<MusicPanel sessionId="sess-1" currentUserId="uid-me" isHost={true} />)
      expect(screen.getAllByRole('listitem')[0]).toHaveAttribute('aria-current', 'true')
    })

    it('空キューに最初の曲が INSERT されたとき onMusicAdd コールバックを呼ぶ', () => {
      const onMusicAdd = vi.fn()
      mockLinks.value = [link1]
      render(<MusicPanel sessionId="sess-1" currentUserId="uid-me" isHost={true} onMusicAdd={onMusicAdd} />)
      act(() => { capturedOptions.onInsert?.(link1, []) })
      expect(onMusicAdd).toHaveBeenCalledWith(link1)
    })

    it('ホストの再生切り替えで playback state を更新する', async () => {
      mockLinks.value = [link1]
      mockPlaybackState.value = playbackState('ml-1', false)
      mockYouTubePlayer.mockImplementation(({ onPlayToggle }: { onPlayToggle: () => void }) => (
        <button type="button" onClick={onPlayToggle}>toggle-player</button>
      ))
      render(<MusicPanel sessionId="sess-1" currentUserId="uid-me" isHost={true} />)
      await userEvent.click(screen.getByRole('button', { name: 'toggle-player' }))
      expect(mockSetPlaying).toHaveBeenCalledWith(true)
    })

    it('INSERT 到着時: onMusicAdd コールバックを呼ぶ', () => {
      const onMusicAdd = vi.fn()
      mockLinks.value = [link1]
      render(<MusicPanel sessionId="sess-1" currentUserId="uid-me" isHost={true} onMusicAdd={onMusicAdd} />)
      act(() => { capturedOptions.onInsert?.(link2, [link1]) })
      expect(onMusicAdd).toHaveBeenCalledWith(link2)
    })

    it('先頭に INSERT されたとき current_music_link_id の曲が再生中のままになる', () => {
      const newLink: MusicLink = {
        id: 'ml-new', session_id: 'sess-1', added_by_auth_id: 'uid-other',
        url: 'https://youtu.be/new', title: '次に再生される曲',
        sort_order: 0, created_at: '2026-04-26T10:02:00Z',
      }
      mockLinks.value = [link1, link2]
      mockPlaybackState.value = playbackState('ml-1', true)
      const { rerender } = render(<MusicPanel sessionId="sess-1" currentUserId="uid-me" isHost={true} />)
      expect(screen.getAllByRole('listitem')[0]).toHaveAttribute('aria-current', 'true')

      act(() => { capturedOptions.onInsert?.(newLink, [link1, link2]) })

      mockLinks.value = [newLink, link1, link2]
      rerender(<MusicPanel sessionId="sess-1" currentUserId="uid-me" isHost={true} />)

      const items = screen.getAllByRole('listitem')
      expect(items[1]).toHaveAttribute('aria-current', 'true')
    })

    it('onError 発火で deleteLink を呼ぶ', async () => {
      mockLinks.value = [link1, link2]
      mockPlaybackState.value = playbackState('ml-1', true)
      render(<MusicPanel sessionId="sess-1" currentUserId="uid-me" isHost={true} />)
      const onError = mockYouTubePlayer.mock.calls.at(-1)?.[0].onError as () => void
      act(() => { onError() })
      expect(mockSetCurrent).toHaveBeenCalledWith('ml-2', true)
      await waitFor(() => expect(mockDeleteLink).toHaveBeenCalledWith('ml-1'))
    })

    it('onError 発火でスキップトーストが表示される', () => {
      mockLinks.value = [link1]
      mockPlaybackState.value = playbackState('ml-1', true)
      render(<MusicPanel sessionId="sess-1" currentUserId="uid-me" isHost={true} />)
      const onError = mockYouTubePlayer.mock.calls.at(-1)?.[0].onError as () => void
      act(() => { onError() })
      expect(screen.getByRole('status')).toHaveTextContent('再生できないためスキップしました')
    })

    it('スキップトーストは3秒後に消える', () => {
      vi.useFakeTimers()
      mockLinks.value = [link1]
      mockPlaybackState.value = playbackState('ml-1', true)
      render(<MusicPanel sessionId="sess-1" currentUserId="uid-me" isHost={true} />)
      const onError = mockYouTubePlayer.mock.calls.at(-1)?.[0].onError as () => void
      act(() => { onError() })
      expect(screen.getByRole('status')).toBeInTheDocument()
      act(() => { vi.advanceTimersByTime(3000) })
      expect(screen.queryByRole('status')).not.toBeInTheDocument()
    })
  })

  describe('レイアウト順序', () => {
    it('キューリストがTabsエリアより前（上）に表示される', () => {
      mockLinks.value = [link1]
      render(<MusicPanel sessionId="sess-1" currentUserId="uid-me" />)
      const tabsList = screen.getByRole('tablist')
      const queueItem = screen.getByRole('listitem')
      expect(
        queueItem.compareDocumentPosition(tabsList) & Node.DOCUMENT_POSITION_FOLLOWING
      ).toBeTruthy()
    })

    it('キューは初期表示で開いたアコーディオンとして表示され、クリックで閉じられる', async () => {
      mockLinks.value = [link1]
      render(<MusicPanel sessionId="sess-1" currentUserId="uid-me" />)
      const queueAccordion = screen.getByText('キュー').closest('details')
      expect(queueAccordion).toHaveAttribute('open')

      await userEvent.click(screen.getByText('キュー'))
      expect(queueAccordion).not.toHaveAttribute('open')
    })
  })

  describe('非ホスト（isHost=false）', () => {
    it('links があっても YouTubePlayer が表示されない', () => {
      mockLinks.value = [link1]
      render(<MusicPanel sessionId="sess-1" currentUserId="uid-me" isHost={false} />)
      expect(screen.queryByTestId('youtube-player')).not.toBeInTheDocument()
    })

    it('検索タブが表示される', () => {
      render(<MusicPanel sessionId="sess-1" currentUserId="uid-me" isHost={false} />)
      expect(screen.getByPlaceholderText('曲名・アーティスト名で検索')).toBeInTheDocument()
    })

    it('キューが表示される', () => {
      mockLinks.value = [link1]
      render(<MusicPanel sessionId="sess-1" currentUserId="uid-me" isHost={false} />)
      expect(screen.getByText('Never Gonna Give You Up')).toBeInTheDocument()
    })
  })
})
