import { render, screen, waitFor, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import MainPage from './MainPage'
import type { Photo, MusicLink, Session } from '../types/session'
import { loadLastSession, saveLastSession } from '../utils/lastSession'

const {
  mockNavigate,
  mockEndSession,
  mockRemoveChannel,
  mockGetUser,
  mockRpc,
  realtimeCallbacks,
  capturedPhotosInsert,
  capturedMusicPanelProps,
} = vi.hoisted(() => ({
  mockNavigate: vi.fn(),
  mockEndSession: vi.fn(),
  mockRemoveChannel: vi.fn(),
  mockGetUser: vi.fn(),
  mockRpc: vi.fn(),
  realtimeCallbacks: { sessionStatus: null as ((payload: { new: { id: string; status: string } }) => void) | null },
  capturedPhotosInsert: { onInsert: undefined as ((photo: Photo) => void) | undefined },
  capturedMusicPanelProps: {
    onMusicAdd: undefined as ((link: MusicLink) => void) | undefined,
    isHost: undefined as boolean | undefined,
  },
}))

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return { ...actual, useNavigate: () => mockNavigate }
})
vi.mock('../hooks/useSessionEnd', () => ({
  useSessionEnd: () => ({ endSession: mockEndSession, loading: false }),
}))
vi.mock('../hooks/usePhotos', () => ({
  usePhotos: (_sessionId: string, options?: { onInsert?: (photo: Photo) => void }) => {
    capturedPhotosInsert.onInsert = options?.onInsert
    return { photos: [], loading: false, error: null }
  },
}))
vi.mock('../hooks/useParticipants', () => ({
  useParticipants: () => ({
    participants: [
      { id: 'p-1', auth_id: 'uid-host', name: 'Alice', session_id: 'sess-1', joined_at: '' },
      { id: 'p-2', auth_id: 'uid-bob', name: 'Bob', session_id: 'sess-1', joined_at: '' },
    ],
  }),
}))
vi.mock('qrcode', () => ({
  default: { toDataURL: vi.fn().mockResolvedValue('data:image/png;base64,mock') },
}))
vi.mock('./Slideshow', () => ({
  default: () => <div data-testid="slideshow" />,
}))
vi.mock('./PhotoUpload', () => ({
  default: () => <div data-testid="photo-upload" />,
}))
vi.mock('./MusicPanel', () => ({
  default: ({ onMusicAdd, isHost }: { onMusicAdd?: (link: MusicLink) => void; isHost?: boolean }) => {
    capturedMusicPanelProps.onMusicAdd = onMusicAdd
    capturedMusicPanelProps.isHost = isHost
    return <div data-testid="music-panel" />
  },
}))
vi.mock('../lib/supabase', () => {
  const channelMock = {
    on: (_e: string, _f: unknown, cb: (payload: { new: { id: string; status: string } }) => void) => {
      realtimeCallbacks.sessionStatus = cb
      return channelMock
    },
    subscribe: () => channelMock,
  }
  return {
    supabase: {
      auth: { getUser: mockGetUser },
      rpc: mockRpc,
      channel: () => channelMock,
      removeChannel: mockRemoveChannel,
    },
  }
})

const fakeSession: Session = {
  id: 'sess-1', code: '472819', host_name: 'Alice', host_auth_id: 'uid-host',
  status: 'active', last_active_at: '', inactivity_timeout_min: 360, created_at: '',
}

function renderAsHost() {
  mockGetUser.mockResolvedValue({ data: { user: { id: 'uid-host' } } })
  return render(
    <MemoryRouter initialEntries={[{ pathname: '/session/sess-1', state: { session: fakeSession } }]}>
      <Routes><Route path="/session/:sessionId" element={<MainPage />} /></Routes>
    </MemoryRouter>
  )
}

function renderAsParticipant() {
  mockGetUser.mockResolvedValue({ data: { user: { id: 'uid-other' } } })
  return render(
    <MemoryRouter initialEntries={[{ pathname: '/session/sess-1', state: { session: fakeSession } }]}>
      <Routes><Route path="/session/:sessionId" element={<MainPage />} /></Routes>
    </MemoryRouter>
  )
}

describe('MainPage - ホスト', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    capturedPhotosInsert.onInsert = undefined
    capturedMusicPanelProps.onMusicAdd = undefined
    capturedMusicPanelProps.isHost = undefined
    localStorage.clear()
    vi.spyOn(window, 'confirm').mockReturnValue(true)
  })

  it('写真タブ（デフォルト）でSlideshowが表示される', async () => {
    renderAsHost()
    await waitFor(() => expect(screen.getByTestId('slideshow')).toBeInTheDocument())
  })

  it('参加者数がヘッダーに表示される', async () => {
    renderAsHost()
    await waitFor(() => expect(screen.queryByText('2/4')).not.toBeInTheDocument())
  })

  it('ヘッダーにセッション終了ボタンが表示される', async () => {
    renderAsHost()
    await waitFor(() => expect(screen.getByRole('button', { name: 'セッション終了' })).toBeInTheDocument())
  })

  it('メンバータブに切り替えるとQRコードが表示される', async () => {
    renderAsHost()
    await waitFor(() => screen.getByRole('tab', { name: /メンバー/ }))
    await userEvent.click(screen.getByRole('tab', { name: /メンバー/ }))
    expect(await screen.findByAltText('QR Code')).toBeInTheDocument()
  })

  it('メンバータブに切り替えると参加コードが表示される', async () => {
    renderAsHost()
    await waitFor(() => screen.getByRole('tab', { name: /メンバー/ }))
    await userEvent.click(screen.getByRole('tab', { name: /メンバー/ }))
    expect(await screen.findByText('472819')).toBeInTheDocument()
  })

  it('ヘッダーのセッション終了ボタンでendSessionを呼び/へ遷移', async () => {
    mockEndSession.mockResolvedValue(true)
    renderAsHost()
    await userEvent.click(await screen.findByRole('button', { name: 'セッション終了' }))
    expect(mockEndSession).toHaveBeenCalledWith('sess-1')
    expect(mockNavigate).toHaveBeenCalledWith('/')
  })

  it('セッション終了ボタンで前回セッションを削除する', async () => {
    mockEndSession.mockResolvedValue(true)
    saveLastSession(fakeSession)

    renderAsHost()
    await userEvent.click(await screen.findByRole('button', { name: 'セッション終了' }))

    expect(loadLastSession()).toBeNull()
  })

  it('外部からstatus=endedになったら/へ遷移', async () => {
    renderAsHost()
    await waitFor(() => realtimeCallbacks.sessionStatus !== null)
    realtimeCallbacks.sessionStatus!({ new: { id: 'sess-1', status: 'ended' } })
    expect(mockNavigate).toHaveBeenCalledWith('/')
  })

  it('外部からstatus=endedになったら前回セッションを削除する', async () => {
    saveLastSession(fakeSession)

    renderAsHost()
    await waitFor(() => realtimeCallbacks.sessionStatus !== null)
    realtimeCallbacks.sessionStatus!({ new: { id: 'sess-1', status: 'ended' } })

    expect(loadLastSession()).toBeNull()
  })

  it('別セッションのstatus=ended更新では遷移しない', async () => {
    renderAsHost()
    await waitFor(() => realtimeCallbacks.sessionStatus !== null)
    realtimeCallbacks.sessionStatus!({ new: { id: 'other-sess', status: 'ended' } })
    expect(mockNavigate).not.toHaveBeenCalled()
  })

  it('MusicPanel に isHost=true が渡る', async () => {
    renderAsHost()
    await waitFor(() => expect(capturedMusicPanelProps.isHost).toBe(true))
  })

  it('メンバータブで非ホストメンバーをキックできる', async () => {
    mockRpc.mockResolvedValue({ error: null })
    renderAsHost()

    await waitFor(() => screen.getByRole('tab', { name: /メンバー/ }))
    await userEvent.click(screen.getByRole('tab', { name: /メンバー/ }))
    await userEvent.click(await screen.findByRole('button', { name: 'Bobをキック' }))

    expect(window.confirm).toHaveBeenCalledWith('Bobさんをセッションから退出させますか？')
    expect(mockRpc).toHaveBeenCalledWith('kick_participant', { p_participant_id: 'p-2' })
  })

  it('メンバータブでホスト自身のキックボタンは表示しない', async () => {
    renderAsHost()

    await waitFor(() => screen.getByRole('tab', { name: /メンバー/ }))
    await userEvent.click(screen.getByRole('tab', { name: /メンバー/ }))

    expect(screen.queryByRole('button', { name: 'Aliceをキック' })).not.toBeInTheDocument()
  })
})

describe('MainPage - 参加者', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    capturedPhotosInsert.onInsert = undefined
    capturedMusicPanelProps.onMusicAdd = undefined
    capturedMusicPanelProps.isHost = undefined
    vi.spyOn(window, 'confirm').mockReturnValue(true)
  })

  it('写真タブにSlideshowが表示されない', async () => {
    renderAsParticipant()
    await waitFor(() => expect(screen.getByTestId('photo-upload')).toBeInTheDocument())
    expect(screen.queryByTestId('slideshow')).not.toBeInTheDocument()
  })

  it('PhotoUploadが表示される', async () => {
    renderAsParticipant()
    await waitFor(() => expect(screen.getByTestId('photo-upload')).toBeInTheDocument())
  })

  it('音楽タブに切り替えるとMusicPanelが表示される', async () => {
    renderAsParticipant()
    await waitFor(() => screen.getByRole('tab', { name: /音楽/ }))
    await userEvent.click(screen.getByRole('tab', { name: /音楽/ }))
    await waitFor(() => expect(screen.getByTestId('music-panel')).toBeInTheDocument())
  })

  it('セッション終了ボタンが存在しない', async () => {
    renderAsParticipant()
    await waitFor(() => expect(screen.getByTestId('photo-upload')).toBeInTheDocument())
    expect(screen.queryByRole('button', { name: 'セッション終了' })).not.toBeInTheDocument()
  })

  it('ヘッダーに退出ボタンが表示される', async () => {
    renderAsParticipant()
    await waitFor(() => expect(screen.getByRole('button', { name: '退出' })).toBeInTheDocument())
    expect(screen.queryByText('2/4')).not.toBeInTheDocument()
  })

  it('退出ボタンでleave_sessionを呼び/へ遷移する', async () => {
    mockRpc.mockResolvedValue({ error: null })
    renderAsParticipant()

    await userEvent.click(await screen.findByRole('button', { name: '退出' }))

    expect(window.confirm).toHaveBeenCalledWith('セッションから退出しますか？')
    expect(mockRpc).toHaveBeenCalledWith('leave_session', { p_session_id: 'sess-1' })
    expect(mockNavigate).toHaveBeenCalledWith('/')
  })

  it('写真タブ表示中も MusicPanel が DOM に残る', async () => {
    renderAsParticipant()
    await waitFor(() => expect(screen.getByTestId('photo-upload')).toBeInTheDocument())
    expect(screen.getByTestId('music-panel')).toBeInTheDocument()
  })

  it('メンバータブでホストにcrownアイコンが付く', async () => {
    renderAsParticipant()
    await waitFor(() => screen.getByRole('tab', { name: /メンバー/ }))
    await userEvent.click(screen.getByRole('tab', { name: /メンバー/ }))
    expect(await screen.findByText('Alice')).toBeInTheDocument()
  })

  it('メンバータブで非ホストにcrownアイコンが付かない', async () => {
    renderAsParticipant()
    await waitFor(() => screen.getByRole('tab', { name: /メンバー/ }))
    await userEvent.click(screen.getByRole('tab', { name: /メンバー/ }))
    await screen.findByText('Bob')
    const items = screen.getAllByRole('listitem')
    const bobItem = items[1]
    expect(bobItem.querySelector('svg')).toBeNull()
  })

  it('メンバータブでホストが先頭に表示される', async () => {
    renderAsParticipant()
    await waitFor(() => screen.getByRole('tab', { name: /メンバー/ }))
    await userEvent.click(screen.getByRole('tab', { name: /メンバー/ }))
    await screen.findByText('Alice')
    const items = screen.getAllByRole('listitem')
    expect(items[0]).toHaveTextContent('Alice')
    expect(items[1]).toHaveTextContent('Bob')
  })

  it('MusicPanel に isHost=false が渡る', async () => {
    renderAsParticipant()
    await waitFor(() => expect(capturedMusicPanelProps.isHost).toBe(false))
  })

  it('メンバータブでキックボタンを表示しない', async () => {
    renderAsParticipant()

    await waitFor(() => screen.getByRole('tab', { name: /メンバー/ }))
    await userEvent.click(screen.getByRole('tab', { name: /メンバー/ }))

    expect(screen.queryByRole('button', { name: 'Bobをキック' })).not.toBeInTheDocument()
  })
})

describe('MainPage - トースト', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    capturedPhotosInsert.onInsert = undefined
    capturedMusicPanelProps.onMusicAdd = undefined
    capturedMusicPanelProps.isHost = undefined
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('写真追加時: 追加者名のトーストが表示される', async () => {
    renderAsParticipant()
    await waitFor(() => expect(screen.getByTestId('photo-upload')).toBeInTheDocument())
    const photo: Photo = {
      id: 'ph-new', session_id: 'sess-1', uploader_auth_id: 'uid-host',
      storage_path: 'x.jpg', created_at: '',
    }
    act(() => { capturedPhotosInsert.onInsert?.(photo) })
    expect(screen.getByText('Aliceさんが写真を追加しました')).toBeInTheDocument()
  })

  it('音楽追加時: 追加者名のトーストが表示される', async () => {
    renderAsParticipant()
    await waitFor(() => expect(screen.getByTestId('photo-upload')).toBeInTheDocument())
    const link: MusicLink = {
      id: 'ml-new', session_id: 'sess-1', added_by_auth_id: 'uid-bob',
      url: 'https://youtu.be/abc', title: '', sort_order: 0, created_at: '',
    }
    act(() => { capturedMusicPanelProps.onMusicAdd?.(link) })
    expect(screen.getByText('Bobさんが音楽を追加しました')).toBeInTheDocument()
  })

  it('不明な auth_id の場合は "メンバー" と表示される', async () => {
    renderAsParticipant()
    await waitFor(() => expect(screen.getByTestId('photo-upload')).toBeInTheDocument())
    const photo: Photo = {
      id: 'ph-new', session_id: 'sess-1', uploader_auth_id: 'uid-unknown',
      storage_path: 'x.jpg', created_at: '',
    }
    act(() => { capturedPhotosInsert.onInsert?.(photo) })
    expect(screen.getByText('メンバーさんが写真を追加しました')).toBeInTheDocument()
  })

  it('トーストは3秒後に自動消去される', async () => {
    renderAsParticipant()
    await waitFor(() => expect(screen.getByTestId('photo-upload')).toBeInTheDocument())
    vi.useFakeTimers()
    const photo: Photo = {
      id: 'ph-new', session_id: 'sess-1', uploader_auth_id: 'uid-host',
      storage_path: 'x.jpg', created_at: '',
    }
    act(() => { capturedPhotosInsert.onInsert?.(photo) })
    expect(screen.getByText('Aliceさんが写真を追加しました')).toBeInTheDocument()
    act(() => { vi.advanceTimersByTime(3000) })
    expect(screen.queryByText('Aliceさんが写真を追加しました')).not.toBeInTheDocument()
  })
})
