import { act, renderHook, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useParticipants } from './useParticipants'
import type { Participant } from '../types/session'

const {
  mockSubscribe,
  mockOn,
  mockChannel,
  mockRemoveChannel,
  mockInitialFetch,
} = vi.hoisted(() => ({
  mockSubscribe: vi.fn(() => ({ unsubscribe: vi.fn() })),
  mockOn: vi.fn(),
  mockChannel: vi.fn(),
  mockRemoveChannel: vi.fn(),
  mockInitialFetch: vi.fn(),
}))

vi.mock('../lib/supabase', () => ({
  supabase: {
    from: () => ({
      select: () => ({ eq: () => mockInitialFetch() }),
    }),
    channel: mockChannel,
    removeChannel: mockRemoveChannel,
  },
}))

const alice: Participant = {
  id: 'p-1', session_id: 'sess-1', name: 'Alice',
  auth_id: 'uid-1', joined_at: '2026-04-24T10:00:00Z',
}
const bob: Participant = {
  id: 'p-2', session_id: 'sess-1', name: 'Bob',
  auth_id: 'uid-2', joined_at: '2026-04-24T10:05:00Z',
}

describe('useParticipants', () => {
  let insertHandler: (payload: { new: Participant }) => void
  let deleteHandler: (payload: { old: Pick<Participant, 'id'> }) => void

  beforeEach(() => {
    vi.clearAllMocks()
    mockInitialFetch.mockResolvedValue({ data: [alice], error: null })
    mockOn.mockImplementation((_event: string, filter: { event: string }, handler: unknown) => {
      if (filter.event === 'INSERT') {
        insertHandler = handler as (payload: { new: Participant }) => void
      }
      if (filter.event === 'DELETE') {
        deleteHandler = handler as (payload: { old: Pick<Participant, 'id'> }) => void
      }
      return { on: mockOn, subscribe: mockSubscribe }
    })
    mockChannel.mockReturnValue({ on: mockOn })
  })

  it('初期取得: 既存参加者リストを返す', async () => {
    const { result } = renderHook(() => useParticipants('sess-1'))
    await waitFor(() => expect(result.current.participants).toHaveLength(1))
    expect(result.current.participants[0].name).toBe('Alice')
  })

  it('Realtime INSERT: 新規参加者を追加する', async () => {
    const { result } = renderHook(() => useParticipants('sess-1'))
    await waitFor(() => expect(result.current.participants).toHaveLength(1))

    // Realtimeイベントをシミュレート
    act(() => { insertHandler({ new: bob }) })
    await waitFor(() => expect(result.current.participants).toHaveLength(2))
    expect(result.current.participants[1].name).toBe('Bob')
  })

  it('Realtime INSERT: onInsertコールバックに新規参加者を渡す', async () => {
    const onInsert = vi.fn()
    renderHook(() => useParticipants('sess-1', { onInsert }))
    await waitFor(() => expect(mockInitialFetch).toHaveBeenCalled())

    act(() => { insertHandler({ new: bob }) })

    expect(onInsert).toHaveBeenCalledWith(bob)
  })

  it('Realtime DELETE: 削除された参加者をリストから除く', async () => {
    mockInitialFetch.mockResolvedValue({ data: [alice, bob], error: null })
    const { result } = renderHook(() => useParticipants('sess-1'))
    await waitFor(() => expect(result.current.participants).toHaveLength(2))

    act(() => { deleteHandler({ old: { id: 'p-2' } }) })

    await waitFor(() => expect(result.current.participants).toHaveLength(1))
    expect(result.current.participants[0].name).toBe('Alice')
  })

  it('removeParticipant: 指定した参加者を即座にリストから除く', async () => {
    mockInitialFetch.mockResolvedValue({ data: [alice, bob], error: null })
    const { result } = renderHook(() => useParticipants('sess-1'))
    await waitFor(() => expect(result.current.participants).toHaveLength(2))

    act(() => { result.current.removeParticipant('p-2') })

    await waitFor(() => expect(result.current.participants).toHaveLength(1))
    expect(result.current.participants[0].name).toBe('Alice')
  })

  it('初期取得中は loading=true、取得後は false を返す', async () => {
    const { result } = renderHook(() => useParticipants('sess-1'))

    expect(result.current.loading).toBe(true)
    await waitFor(() => expect(result.current.loading).toBe(false))
  })

  it('初期取得エラーを返す', async () => {
    const fetchError = new Error('fetch failed')
    mockInitialFetch.mockResolvedValue({ data: null, error: fetchError })

    const { result } = renderHook(() => useParticipants('sess-1'))

    await waitFor(() => expect(result.current.error).toBe(fetchError))
    expect(result.current.loading).toBe(false)
  })

  it('アンマウント時: チャンネルを削除する', () => {
    const { unmount } = renderHook(() => useParticipants('sess-1'))
    unmount()
    expect(mockRemoveChannel).toHaveBeenCalledOnce()
  })
})
