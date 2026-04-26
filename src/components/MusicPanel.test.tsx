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
