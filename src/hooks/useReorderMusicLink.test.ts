import { renderHook, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useReorderMusicLink } from './useReorderMusicLink'

const mockUpdate = vi.fn()

vi.mock('../lib/supabase', () => ({
  supabase: {
    from: () => ({
      update: (data: unknown) => ({ eq: () => mockUpdate(data) }),
    }),
  },
}))

describe('useReorderMusicLink', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('reorder: UPDATE を { sort_order: newSortOrder } で呼び true を返す', async () => {
    mockUpdate.mockResolvedValue({ error: null })
    const { result } = renderHook(() => useReorderMusicLink())

    let ok: boolean | undefined
    await act(async () => {
      ok = await result.current.reorder('ml-1', 1500)
    })

    expect(ok).toBe(true)
    expect(mockUpdate).toHaveBeenCalledWith({ sort_order: 1500 })
  })

  it('DB エラーで false を返す', async () => {
    mockUpdate.mockResolvedValue({ error: new Error('DB error') })
    const { result } = renderHook(() => useReorderMusicLink())

    let ok: boolean | undefined
    await act(async () => {
      ok = await result.current.reorder('ml-1', 1500)
    })

    expect(ok).toBe(false)
  })
})
