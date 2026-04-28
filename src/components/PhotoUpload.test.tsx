import { render, screen, act, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import PhotoUpload from './PhotoUpload'
import type { Photo } from '../types/session'

const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

const { mockUpload, mockDeletePhoto, mockError } = vi.hoisted(() => ({
  mockUpload: vi.fn(),
  mockDeletePhoto: vi.fn(),
  mockError: { value: null as string | null },
}))

vi.mock('../hooks/useUploadPhoto', () => ({
  useUploadPhoto: () => ({
    upload: mockUpload,
    deletePhoto: mockDeletePhoto,
    loading: false,
    error: mockError.value,
  }),
}))

vi.mock('../lib/supabase', () => ({
  supabase: {
    storage: {
      from: () => ({
        createSignedUrl: (path: string) =>
          Promise.resolve({ data: { signedUrl: `https://example.com/${path}` }, error: null }),
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
  beforeEach(() => {
    vi.clearAllMocks()
    mockFetch.mockResolvedValue({
      blob: () => Promise.resolve(new Blob(['img'], { type: 'image/jpeg' })),
    })
    mockError.value = null
    // navigator.canShare/share をリセット
    Object.defineProperty(globalThis, 'navigator', {
      value: {
        canShare: vi.fn().mockReturnValue(true),
        share: vi.fn().mockResolvedValue(undefined),
      },
      writable: true,
      configurable: true,
    })
  })

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

  it('自分の写真には削除ボタンが表示される', async () => {
    await act(async () => {
      render(
        <PhotoUpload sessionId="sess-1" photos={[myPhoto]} currentUserId="uid-me" />
      )
    })
    expect(screen.getByRole('button', { name: '削除' })).toBeInTheDocument()
  })

  it('他人の写真には削除ボタンが表示されない', async () => {
    await act(async () => {
      render(
        <PhotoUpload sessionId="sess-1" photos={[otherPhoto]} currentUserId="uid-me" />
      )
    })
    expect(screen.queryByRole('button', { name: '削除' })).not.toBeInTheDocument()
  })

  it('削除ボタンクリックでdeletePhotoを呼ぶ', async () => {
    mockDeletePhoto.mockResolvedValue(true)
    await act(async () => {
      render(
        <PhotoUpload sessionId="sess-1" photos={[myPhoto]} currentUserId="uid-me" />
      )
    })
    await userEvent.click(screen.getByRole('button', { name: '削除' }))
    expect(mockDeletePhoto).toHaveBeenCalledWith('ph-1', 'sess-1/001_a.jpg')
  })

  it('エラー時はアラートメッセージを表示する', () => {
    mockError.value = 'アップロードに失敗しました'
    render(
      <PhotoUpload sessionId="sess-1" photos={[]} currentUserId="uid-me" />
    )
    expect(screen.getByRole('alert')).toHaveTextContent('アップロードに失敗しました')
  })

  describe('全写真を保存ボタン', () => {
    it('写真が0枚のときはボタンを表示しない', () => {
      render(
        <PhotoUpload sessionId="sess-1" photos={[]} currentUserId="uid-me" />
      )
      expect(screen.queryByRole('button', { name: /全写真を保存/ })).not.toBeInTheDocument()
    })

    it('canShare=falseのときはボタンを表示しない', () => {
      Object.defineProperty(globalThis, 'navigator', {
        value: { canShare: vi.fn().mockReturnValue(false), share: vi.fn() },
        writable: true,
        configurable: true,
      })
      render(
        <PhotoUpload sessionId="sess-1" photos={[myPhoto, otherPhoto]} currentUserId="uid-me" />
      )
      expect(screen.queryByRole('button', { name: /全写真を保存/ })).not.toBeInTheDocument()
    })

    it('canShare=trueかつ写真があるときはボタンを表示する', () => {
      render(
        <PhotoUpload sessionId="sess-1" photos={[myPhoto, otherPhoto]} currentUserId="uid-me" />
      )
      expect(screen.getByRole('button', { name: /全写真を保存/ })).toBeInTheDocument()
    })

    it('ボタンクリックで全写真URLをfetchしnavigator.shareを呼ぶ', async () => {
      render(
        <PhotoUpload sessionId="sess-1" photos={[myPhoto, otherPhoto]} currentUserId="uid-me" />
      )
      await userEvent.click(screen.getByRole('button', { name: /全写真を保存/ }))
      expect(mockFetch).toHaveBeenCalledTimes(2)
      expect(mockFetch).toHaveBeenCalledWith('https://example.com/sess-1/001_a.jpg')
      expect(mockFetch).toHaveBeenCalledWith('https://example.com/sess-1/002_b.jpg')
      expect(navigator.share).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'CampCanvas 写真' })
      )
    })

    it('保存中はボタンが無効化される', async () => {
      let resolveShare!: () => void
      ;(navigator.share as ReturnType<typeof vi.fn>).mockReturnValue(
        new Promise<void>((res) => { resolveShare = res })
      )
      render(
        <PhotoUpload sessionId="sess-1" photos={[myPhoto]} currentUserId="uid-me" />
      )
      const btn = screen.getByRole('button', { name: /全写真を保存/ })
      await userEvent.click(btn)
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /読み込み中/ })).toBeDisabled()
      })
      await act(async () => resolveShare())
    })

    it('AbortErrorは無視される', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      ;(navigator.share as ReturnType<typeof vi.fn>).mockRejectedValue(
        Object.assign(new Error('abort'), { name: 'AbortError' })
      )
      render(
        <PhotoUpload sessionId="sess-1" photos={[myPhoto]} currentUserId="uid-me" />
      )
      await userEvent.click(screen.getByRole('button', { name: /全写真を保存/ }))
      expect(consoleSpy).not.toHaveBeenCalled()
      consoleSpy.mockRestore()
    })
  })
})
