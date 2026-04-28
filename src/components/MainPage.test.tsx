import { render, screen, waitFor, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import MainPage from './MainPage'
import type { Photo, MusicLink } from '../types/session'

const {
  mockNavigate,
  mockEndSession,
  mockRemoveChannel,
  mockGetUser,
  realtimeCallbacks,
  capturedPhotosInsert,
  capturedMusicPanelProps,
} = vi.hoisted(() => ({
  mockNavigate: vi.fn(),
  mockEndSession: vi.fn(),
  mockRemoveChannel: vi.fn(),
  mockGetUser: vi.fn(),
  realtimeCallbacks: { sessionStatus: null as ((payload: { new: { id: string; status: string } }) => void) | null },
  capturedPhotosInsert: { onInsert: undefined as ((photo: Photo) => void) | undefined },
  capturedMusicPanelProps: { onMusicAdd: undefined as ((link: MusicLink) => void) | undefined },
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
      { id: 'p-1', auth_id: 'uid-alice', name: 'Alice' },
      { id: 'p-2', auth_id: 'uid-bob', name: 'Bob' },
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
  default: ({ onMusicAdd }: { onMusicAdd?: (link: MusicLink) => void }) => {
    capturedMusicPanelProps.onMusicAdd = onMusicAdd
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
    capturedPhotosInsert.onInsert = undefined
    capturedMusicPanelProps.onMusicAdd = undefined
    vi.spyOn(window, 'confirm').mockReturnValue(true)
  })

  it('写真タブ（デフォルト）でSlideshowが表示される', async () => {
    renderAsHost()
    await waitFor(() => expect(screen.getByTestId('slideshow')).toBeInTheDocument())
  })

  it('参加者数がヘッダーに表示される', async () => {
    renderAsHost()
    await waitFor(() => expect(screen.getByText('👥 2/4')).toBeInTheDocument())
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

  it('メンバータブのセッション終了ボタンでendSessionを呼び/へ遷移', async () => {
    mockEndSession.mockResolvedValue(true)
    renderAsHost()
    await waitFor(() => screen.getByRole('tab', { name: /メンバー/ }))
    await userEvent.click(screen.getByRole('tab', { name: /メンバー/ }))
    await userEvent.click(await screen.findByRole('button', { name: 'セッション終了' }))
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
  beforeEach(() => {
    vi.clearAllMocks()
    capturedPhotosInsert.onInsert = undefined
    capturedMusicPanelProps.onMusicAdd = undefined
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

  it('写真タブ表示中も MusicPanel が DOM に残る', async () => {
    renderAsParticipant()
    await waitFor(() => expect(screen.getByTestId('photo-upload')).toBeInTheDocument())
    expect(screen.getByTestId('music-panel')).toBeInTheDocument()
  })
})

describe('MainPage - トースト', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    capturedPhotosInsert.onInsert = undefined
    capturedMusicPanelProps.onMusicAdd = undefined
  })

  it('写真追加時: 追加者名のトーストが表示される', async () => {
    renderAsParticipant()
    await waitFor(() => expect(screen.getByTestId('photo-upload')).toBeInTheDocument())
    const photo: Photo = {
      id: 'ph-new', session_id: 'sess-1', uploader_auth_id: 'uid-alice',
      storage_path: 'x.jpg', created_at: '',
    }
    act(() => { capturedPhotosInsert.onInsert?.(photo) })
    expect(screen.getByText('📷 Aliceさんが写真を追加しました')).toBeInTheDocument()
  })

  it('音楽追加時: 追加者名のトーストが表示される', async () => {
    renderAsParticipant()
    await waitFor(() => expect(screen.getByTestId('photo-upload')).toBeInTheDocument())
    const link: MusicLink = {
      id: 'ml-new', session_id: 'sess-1', added_by_auth_id: 'uid-bob',
      url: 'https://youtu.be/abc', created_at: '',
    }
    act(() => { capturedMusicPanelProps.onMusicAdd?.(link) })
    expect(screen.getByText('🎵 Bobさんが音楽を追加しました')).toBeInTheDocument()
  })

  it('不明な auth_id の場合は "メンバー" と表示される', async () => {
    renderAsParticipant()
    await waitFor(() => expect(screen.getByTestId('photo-upload')).toBeInTheDocument())
    const photo: Photo = {
      id: 'ph-new', session_id: 'sess-1', uploader_auth_id: 'uid-unknown',
      storage_path: 'x.jpg', created_at: '',
    }
    act(() => { capturedPhotosInsert.onInsert?.(photo) })
    expect(screen.getByText('📷 メンバーさんが写真を追加しました')).toBeInTheDocument()
  })

  it('トーストは3秒後に自動消去される', async () => {
    renderAsParticipant()
    await waitFor(() => expect(screen.getByTestId('photo-upload')).toBeInTheDocument())
    vi.useFakeTimers()
    const photo: Photo = {
      id: 'ph-new', session_id: 'sess-1', uploader_auth_id: 'uid-alice',
      storage_path: 'x.jpg', created_at: '',
    }
    act(() => { capturedPhotosInsert.onInsert?.(photo) })
    expect(screen.getByText('📷 Aliceさんが写真を追加しました')).toBeInTheDocument()
    act(() => { vi.advanceTimersByTime(3000) })
    expect(screen.queryByText('📷 Aliceさんが写真を追加しました')).not.toBeInTheDocument()
    vi.useRealTimers()
  })
})
