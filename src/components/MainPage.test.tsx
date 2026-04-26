import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import MainPage from './MainPage'

const { mockNavigate, mockEndSession, mockRemoveChannel, mockGetUser, realtimeCallbacks } = vi.hoisted(() => ({
  mockNavigate: vi.fn(),
  mockEndSession: vi.fn(),
  mockRemoveChannel: vi.fn(),
  mockGetUser: vi.fn(),
  realtimeCallbacks: { sessionStatus: null as ((payload: { new: { id: string; status: string } }) => void) | null },
}))

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return { ...actual, useNavigate: () => mockNavigate }
})
vi.mock('../hooks/useSessionEnd', () => ({
  useSessionEnd: () => ({ endSession: mockEndSession, loading: false }),
}))
vi.mock('../hooks/usePhotos', () => ({
  usePhotos: () => ({ photos: [], loading: false, error: null }),
}))
vi.mock('./JoinOverlay', () => ({
  default: ({ onClose }: { onClose: () => void }) => (
    <div role="dialog"><button onClick={onClose}>閉じる</button></div>
  ),
}))
vi.mock('./Slideshow', () => ({
  default: () => <div data-testid="slideshow" />,
}))
vi.mock('./PhotoUpload', () => ({
  default: () => <div data-testid="photo-upload" />,
}))
vi.mock('./MusicPanel', () => ({
  default: () => <div data-testid="music-panel" />,
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
      channel: () => channelMock,
      removeChannel: mockRemoveChannel,
    },
  }
})

const fakeSession = {
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
    vi.spyOn(window, 'confirm').mockReturnValue(true)
  })

  it('Slideshowが表示される', async () => {
    renderAsHost()
    await waitFor(() => expect(screen.getByTestId('slideshow')).toBeInTheDocument())
  })

  it('「＋メンバー」ボタンが存在する', async () => {
    renderAsHost()
    await waitFor(() => expect(screen.getByRole('button', { name: '＋メンバー' })).toBeInTheDocument())
  })

  it('「＋メンバー」クリックでJoinOverlayが表示される', async () => {
    renderAsHost()
    await waitFor(() => screen.getByRole('button', { name: '＋メンバー' }))
    await userEvent.click(screen.getByRole('button', { name: '＋メンバー' }))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('JoinOverlayの閉じるでオーバーレイが非表示になる', async () => {
    renderAsHost()
    await waitFor(() => screen.getByRole('button', { name: '＋メンバー' }))
    await userEvent.click(screen.getByRole('button', { name: '＋メンバー' }))
    await userEvent.click(screen.getByRole('button', { name: '閉じる' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('「セッション終了」確認後にendSessionを呼び/へ遷移', async () => {
    mockEndSession.mockResolvedValue(true)
    renderAsHost()
    await waitFor(() => screen.getByRole('button', { name: 'セッション終了' }))
    await userEvent.click(screen.getByRole('button', { name: 'セッション終了' }))
    expect(mockEndSession).toHaveBeenCalledWith('sess-1')
    expect(mockNavigate).toHaveBeenCalledWith('/')
  })

  it('外部からstatus=endedになったら/へ遷移', async () => {
    renderAsHost()
    await waitFor(() => realtimeCallbacks.sessionStatus !== null)
    realtimeCallbacks.sessionStatus!({ new: { id: 'sess-1', status: 'ended' } })
    expect(mockNavigate).toHaveBeenCalledWith('/')
  })

  it('別セッションのstatus=ended更新では遷移しない', async () => {
    renderAsHost()
    await waitFor(() => realtimeCallbacks.sessionStatus !== null)
    realtimeCallbacks.sessionStatus!({ new: { id: 'other-sess', status: 'ended' } })
    expect(mockNavigate).not.toHaveBeenCalled()
  })
})

describe('MainPage - 参加者', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('Slideshowが表示されない', async () => {
    renderAsParticipant()
    await waitFor(() => expect(screen.getByTestId('photo-upload')).toBeInTheDocument())
    expect(screen.queryByTestId('slideshow')).not.toBeInTheDocument()
  })

  it('「セッション終了」ボタンが表示されない', async () => {
    renderAsParticipant()
    await waitFor(() => expect(screen.getByTestId('photo-upload')).toBeInTheDocument())
    expect(screen.queryByRole('button', { name: 'セッション終了' })).not.toBeInTheDocument()
  })

  it('PhotoUploadとMusicPanelは表示される', async () => {
    renderAsParticipant()
    await waitFor(() => expect(screen.getByTestId('photo-upload')).toBeInTheDocument())
    expect(screen.getByTestId('music-panel')).toBeInTheDocument()
  })
})
