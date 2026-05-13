import { act, renderHook, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useMusicPlaybackState } from './useMusicPlaybackState'
import type { MusicPlaybackState } from '../types/session'

const {
  mockGetUser, mockSelectSingle, mockUpsert, mockUpdate, mockOn,
  mockSubscribe, mockChannel, mockRemoveChannel,
} = vi.hoisted(() => ({
  mockGetUser: vi.fn(),
  mockSelectSingle: vi.fn(),
  mockUpsert: vi.fn(),
  mockUpdate: vi.fn(),
  mockOn: vi.fn(),
  mockSubscribe: vi.fn(),
  mockChannel: vi.fn(),
  mockRemoveChannel: vi.fn(),
}))

vi.mock('../lib/supabase', () => ({
  supabase: {
    auth: { getUser: mockGetUser },
    from: (_table: string) => ({
      select: () => ({ eq: () => ({ maybeSingle: mockSelectSingle }) }),
      upsert: (data: unknown) => mockUpsert(data),
      update: (data: unknown) => ({ eq: () => mockUpdate(data) }),
    }),
    channel: mockChannel,
    removeChannel: mockRemoveChannel,
  },
}))

const state1: MusicPlaybackState = {
  session_id: 'sess-1',
  current_music_link_id: 'ml-1',
  is_playing: true,
  updated_by_auth_id: 'uid-host',
  updated_at: '2026-05-13T00:00:00Z',
}

describe('useMusicPlaybackState', () => {
  let handlers: Array<(payload: unknown) => void> = []

  beforeEach(() => {
    vi.clearAllMocks()
    handlers = []
    mockGetUser.mockResolvedValue({ data: { user: { id: 'uid-host' } } })
    mockSelectSingle.mockResolvedValue({ data: state1, error: null })
    mockUpsert.mockResolvedValue({ error: null })
    mockUpdate.mockResolvedValue({ error: null })
    const channelApi = { on: mockOn, subscribe: mockSubscribe }
    mockOn.mockImplementation((_event: string, _filter: unknown, handler: (payload: unknown) => void) => {
      handlers.push(handler)
      return channelApi
    })
    mockSubscribe.mockImplementation((callback?: (status: string) => void) => {
      callback?.('SUBSCRIBED')
      return channelApi
    })
    mockChannel.mockReturnValue(channelApi)
  })

  it('初期取得: 購読確立後に playback state を返す', async () => {
    const { result } = renderHook(() => useMusicPlaybackState('sess-1'))
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.state).toEqual(state1)
  })

  it('初期取得は Realtime 購読確立後に開始する', () => {
    mockSubscribe.mockImplementation(() => ({ on: mockOn, subscribe: mockSubscribe }))
    const { result } = renderHook(() => useMusicPlaybackState('sess-1'))
    expect(mockSelectSingle).not.toHaveBeenCalled()
    expect(result.current.loading).toBe(true)
  })

  it('Realtime INSERT/UPDATE で state を置き換える', async () => {
    const { result } = renderHook(() => useMusicPlaybackState('sess-1'))
    await waitFor(() => expect(result.current.loading).toBe(false))
    const nextState = { ...state1, current_music_link_id: 'ml-2', is_playing: false }
    act(() => { handlers[0]({ new: nextState }) })
    expect(result.current.state).toEqual(nextState)
    act(() => { handlers[1]({ new: state1 }) })
    expect(result.current.state).toEqual(state1)
  })

  it('setCurrent: 現在曲と再生状態を upsert する', async () => {
    const { result } = renderHook(() => useMusicPlaybackState('sess-1'))
    await waitFor(() => expect(result.current.loading).toBe(false))
    let ok: boolean | undefined
    await act(async () => {
      ok = await result.current.setCurrent('ml-2', true)
    })
    expect(ok).toBe(true)
    expect(mockUpsert).toHaveBeenCalledWith({
      session_id: 'sess-1',
      current_music_link_id: 'ml-2',
      is_playing: true,
      updated_by_auth_id: 'uid-host',
    })
  })

  it('setPlaying: 再生状態のみ update する', async () => {
    const { result } = renderHook(() => useMusicPlaybackState('sess-1'))
    await waitFor(() => expect(result.current.loading).toBe(false))
    let ok: boolean | undefined
    await act(async () => {
      ok = await result.current.setPlaying(false)
    })
    expect(ok).toBe(true)
    expect(mockUpdate).toHaveBeenCalledWith({
      is_playing: false,
      updated_by_auth_id: 'uid-host',
    })
  })

  it('アンマウント時: チャンネルを削除する', () => {
    const { unmount } = renderHook(() => useMusicPlaybackState('sess-1'))
    unmount()
    expect(mockRemoveChannel).toHaveBeenCalledOnce()
  })
})
