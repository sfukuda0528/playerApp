import { renderHook, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useSessionEnd } from './useSessionEnd'

const { mockUpdate } = vi.hoisted(() => ({
  mockUpdate: vi.fn(),
}))

vi.mock('../lib/supabase', () => ({
  supabase: {
    from: () => ({
      update: () => ({ eq: () => mockUpdate() }),
    }),
  },
}))

describe('useSessionEnd', () => {
  beforeEach(() => vi.clearAllMocks())

  it('成功時: trueを返す', async () => {
    mockUpdate.mockResolvedValue({ error: null })
    const { result } = renderHook(() => useSessionEnd())
    let ok: unknown
    await act(async () => { ok = await result.current.endSession('sess-1') })
    expect(ok).toBe(true)
    expect(result.current.loading).toBe(false)
  })

  it('DB失敗時: falseを返す', async () => {
    mockUpdate.mockResolvedValue({ error: new Error('db error') })
    const { result } = renderHook(() => useSessionEnd())
    let ok: unknown
    await act(async () => { ok = await result.current.endSession('sess-1') })
    expect(ok).toBe(false)
  })
})
