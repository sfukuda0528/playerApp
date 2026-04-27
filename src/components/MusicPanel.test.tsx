import { render, screen, waitFor, act } from '@testing-library/react'
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

  it('handleEnded で aria-current が次のリンクに移動する', () => {
    mockLinks.value = [link1, link2]
    render(<MusicPanel sessionId="sess-1" currentUserId="uid-me" />)
    const onEnded = mockYouTubePlayer.mock.calls[0][0].onEnded as () => void
    act(() => { onEnded() })
    const items = screen.getAllByRole('listitem')
    expect(items[0]).not.toHaveAttribute('aria-current', 'true')
    expect(items[1]).toHaveAttribute('aria-current', 'true')
  })

  it('currentIndex より前のリンク削除で再生が継続する', async () => {
    const myLink1: MusicLink = { ...link1, id: 'ml-mine', added_by_auth_id: 'uid-me' }
    mockLinks.value = [myLink1, link2]
    mockDeleteLink.mockResolvedValue(true)
    const { rerender } = render(<MusicPanel sessionId="sess-1" currentUserId="uid-me" />)
    // handleEnded で currentIndex を 1 に進める
    const onEnded = mockYouTubePlayer.mock.calls[0][0].onEnded as () => void
    act(() => { onEnded() })
    // link2 が再生中 (currentIndex=1)
    const items = screen.getAllByRole('listitem')
    expect(items[1]).toHaveAttribute('aria-current', 'true')
    // link1 (index=0) を削除
    await userEvent.click(screen.getByRole('button', { name: '削除' }))
    expect(mockDeleteLink).toHaveBeenCalledWith('ml-mine')
    // links から myLink1 が消えた後のリスト (link2 のみ)
    mockLinks.value = [link2]
    rerender(<MusicPanel sessionId="sess-1" currentUserId="uid-me" />)
    // link2 が aria-current のまま
    expect(screen.getAllByRole('listitem')[0]).toHaveAttribute('aria-current', 'true')
  })
})
