import { render, screen } from '@testing-library/react'
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
})
