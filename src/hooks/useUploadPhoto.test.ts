import { renderHook, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useUploadPhoto } from './useUploadPhoto'

const { mockGetUser, mockStorageUpload, mockStorageRemove, mockPhotoInsert, mockPhotoDelete } = vi.hoisted(() => ({
  mockGetUser: vi.fn(),
  mockStorageUpload: vi.fn(),
  mockStorageRemove: vi.fn(),
  mockPhotoInsert: vi.fn(),
  mockPhotoDelete: vi.fn(),
}))

vi.mock('../lib/supabase', () => ({
  supabase: {
    auth: { getUser: mockGetUser },
    storage: {
      from: () => ({
        upload: mockStorageUpload,
        remove: mockStorageRemove,
      }),
    },
    from: (table: string) => {
      if (table === 'photos') {
        return {
          insert: () => mockPhotoInsert(),
          delete: () => ({ eq: () => mockPhotoDelete() }),
        }
      }
    },
  },
}))

describe('useUploadPhoto', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetUser.mockResolvedValue({ data: { user: { id: 'uid-1' } } })
  })

  it('upload: Storage upload → photos INSERT の順で呼ぶ', async () => {
    mockStorageUpload.mockResolvedValue({ error: null })
    mockPhotoInsert.mockResolvedValue({ error: null })

    const file = new File(['img'], 'photo.jpg', { type: 'image/jpeg' })
    const { result } = renderHook(() => useUploadPhoto())
    let ok: boolean | undefined
    await act(async () => { ok = await result.current.upload('sess-1', file) })

    expect(ok).toBe(true)
    const uploadCall = mockStorageUpload.mock.invocationCallOrder[0]
    const insertCall = mockPhotoInsert.mock.invocationCallOrder[0]
    expect(uploadCall).toBeLessThan(insertCall)
    expect(mockStorageUpload).toHaveBeenCalledWith(
      expect.stringMatching(/^sess-1\/\d+_photo\.jpg$/),
      file
    )
  })

  it('upload: Storage エラー時は INSERT しない', async () => {
    mockStorageUpload.mockResolvedValue({ error: new Error('storage fail') })

    const file = new File(['img'], 'photo.jpg', { type: 'image/jpeg' })
    const { result } = renderHook(() => useUploadPhoto())
    let ok: boolean | undefined
    await act(async () => { ok = await result.current.upload('sess-1', file) })

    expect(ok).toBe(false)
    expect(mockPhotoInsert).not.toHaveBeenCalled()
    expect(result.current.error).toBeTruthy()
  })

  it('deletePhoto: Storage remove → photos DELETE の順で呼ぶ', async () => {
    mockStorageRemove.mockResolvedValue({ error: null })
    mockPhotoDelete.mockResolvedValue({ error: null })

    const { result } = renderHook(() => useUploadPhoto())
    let ok: boolean | undefined
    await act(async () => { ok = await result.current.deletePhoto('ph-1', 'sess-1/001_a.jpg') })

    expect(ok).toBe(true)
    const removeCall = mockStorageRemove.mock.invocationCallOrder[0]
    const deleteCall = mockPhotoDelete.mock.invocationCallOrder[0]
    expect(removeCall).toBeLessThan(deleteCall)
  })
})
