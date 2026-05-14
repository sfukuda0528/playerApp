import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import InviteScreen from './InviteScreen'
import { loadLastSession } from '../utils/lastSession'

const {
  mockNavigate,
  mockGetUser,
  mockStartSessionRpc,
  mockUpdateSession,
  mockFetchSession,
  mockRemoveChannel,
  mockParticipants,
  realtimeCallbacks,
} = vi.hoisted(() => ({
  mockNavigate: vi.fn(),
  mockGetUser: vi.fn(),
  mockStartSessionRpc: vi.fn(),
  mockUpdateSession: vi.fn(),
  mockFetchSession: vi.fn(),
  mockRemoveChannel: vi.fn(),
  mockParticipants: [
    { id: 'p-1', auth_id: 'uid-alice', name: 'Alice', session_id: 'sess-1', joined_at: '' },
    { id: 'p-2', auth_id: 'uid-bob', name: 'Bob', session_id: 'sess-1', joined_at: '' },
  ],
  realtimeCallbacks: { sessionUpdate: null as ((payload: { new: typeof fakeSession & { started_at?: string | null } }) => void) | null },
}))

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return { ...actual, useNavigate: () => mockNavigate }
})
vi.mock('qrcode', () => ({
  default: { toDataURL: vi.fn().mockResolvedValue('data:image/png;base64,mock') },
}))
vi.mock('../hooks/useParticipants', () => ({
  useParticipants: () => ({
    participants: mockParticipants,
  }),
}))
vi.mock('../lib/supabase', () => ({
  supabase: {
    auth: { getUser: mockGetUser },
    rpc: mockStartSessionRpc,
    from: () => ({
      update: (values: unknown) => ({
        eq: (column: string, value: string) => mockUpdateSession(values, column, value),
      }),
      select: () => ({
        eq: () => ({
          single: () => mockFetchSession(),
        }),
      }),
    }),
    channel: () => ({
      on: (_event: string, _filter: unknown, cb: (payload: { new: typeof fakeSession & { started_at?: string | null } }) => void) => {
        realtimeCallbacks.sessionUpdate = cb
        return {
          subscribe: () => ({}),
        }
      },
    }),
    removeChannel: mockRemoveChannel,
  },
}))

const fakeSession = {
  id: 'sess-1', code: '472819', host_name: 'Alice', host_auth_id: 'uid-alice',
  status: 'active', last_active_at: '', inactivity_timeout_min: 360, created_at: '',
}

function renderWithRoute() {
  return render(
    <MemoryRouter initialEntries={[{ pathname: '/invite/sess-1', state: { session: fakeSession } }]}>
      <Routes>
        <Route path="/invite/:sessionId" element={<InviteScreen />} />
      </Routes>
    </MemoryRouter>
  )
}

describe('InviteScreen', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    mockGetUser.mockResolvedValue({ data: { user: { id: 'uid-alice' } }, error: null })
    mockStartSessionRpc.mockResolvedValue({
      data: { ...fakeSession, started_at: '2026-05-13T00:00:00Z' },
      error: null,
    })
    mockUpdateSession.mockResolvedValue({ data: null, error: null })
    mockFetchSession.mockResolvedValue({ data: fakeSession, error: null })
    mockParticipants.splice(
      0,
      mockParticipants.length,
      { id: 'p-1', auth_id: 'uid-alice', name: 'Alice', session_id: 'sess-1', joined_at: '' },
      { id: 'p-2', auth_id: 'uid-bob', name: 'Bob', session_id: 'sess-1', joined_at: '' },
    )
    realtimeCallbacks.sessionUpdate = null
  })

  it('6桁コードを表示する', async () => {
    renderWithRoute()
    expect(await screen.findByText('472819')).toBeInTheDocument()
  })

  it('表示したセッションを前回セッションとして保存する', async () => {
    renderWithRoute()

    await waitFor(() => expect(loadLastSession()).toEqual(fakeSession))
  })

  it('QR画像を表示する', async () => {
    renderWithRoute()
    expect(await screen.findByAltText('QR Code')).toBeInTheDocument()
  })

  it('参加者数を表示する', async () => {
    renderWithRoute()
    expect(await screen.findByText(/2 \/ 5 人/)).toBeInTheDocument()
  })

  it('リッチなメンバー概要を表示する', async () => {
    renderWithRoute()
    expect(await screen.findByText('参加中')).toBeInTheDocument()
    expect(screen.getByText('空き枠 3')).toBeInTheDocument()
    expect(screen.getByLabelText('Aliceのアバター（あなた）')).toHaveTextContent('A')
    expect(screen.getByLabelText('Bobのアバター')).toHaveTextContent('B')
  })

  it('スタートボタンクリックで/session/:idへ遷移', async () => {
    renderWithRoute()
    await userEvent.click(await screen.findByRole('button', { name: 'スタート' }))
    expect(mockNavigate).toHaveBeenCalledWith('/session/sess-1', {
      state: { session: expect.objectContaining({ ...fakeSession, started_at: expect.any(String) }) },
    })
  })

  it('スタートボタンクリックでsessionsを直接UPDATEしない', async () => {
    renderWithRoute()
    await userEvent.click(await screen.findByRole('button', { name: 'スタート' }))

    expect(mockUpdateSession).not.toHaveBeenCalled()
  })

  it('スタートボタンクリックでホスト専用RPCを呼び、返却された開始済みセッションで遷移する', async () => {
    const startedSession = { ...fakeSession, started_at: '2026-05-13T00:00:00Z' }
    mockStartSessionRpc.mockResolvedValue({ data: startedSession, error: null })

    renderWithRoute()
    await userEvent.click(await screen.findByRole('button', { name: 'スタート' }))

    expect(mockStartSessionRpc).toHaveBeenCalledWith('start_session', { p_session_id: 'sess-1' })
    expect(mockNavigate).toHaveBeenCalledWith('/session/sess-1', {
      state: { session: startedSession },
    })
  })

  it('非ホストにはスタートボタンを表示しない', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'uid-bob' } }, error: null })
    renderWithRoute()

    expect(await screen.findByText('ホストの開始を待っています')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'スタート' })).not.toBeInTheDocument()
  })

  it('非ホストはホストの開始更新を受けると/session/:idへ遷移する', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'uid-bob' } }, error: null })
    renderWithRoute()

    await waitFor(() => expect(realtimeCallbacks.sessionUpdate).not.toBeNull())

    act(() => {
      realtimeCallbacks.sessionUpdate?.({
        new: { ...fakeSession, started_at: '2026-05-13T00:00:00Z' },
      })
    })

    await waitFor(() =>
      expect(mockNavigate).toHaveBeenCalledWith('/session/sess-1', {
        state: { session: expect.objectContaining({ started_at: '2026-05-13T00:00:00Z' }) },
      })
    )
  })

  it('非ホストは再取得したセッションが開始済みなら/session/:idへ遷移する', async () => {
    const startedSession = { ...fakeSession, started_at: '2026-05-13T00:00:00Z' }
    mockGetUser.mockResolvedValue({ data: { user: { id: 'uid-bob' } }, error: null })
    mockFetchSession.mockResolvedValue({ data: startedSession, error: null })

    renderWithRoute()

    await waitFor(() =>
      expect(mockNavigate).toHaveBeenCalledWith('/session/sess-1', {
        state: { session: startedSession },
      })
    )
  })

  it('自分のアバターと名前を強調表示する', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'uid-bob' } }, error: null })
    renderWithRoute()

    expect(await screen.findByLabelText('Bobのアバター（あなた）')).toBeInTheDocument()
    expect(screen.getByText('Bob')).toHaveClass('text-camp-orange')
  })

  it('メンバー名一覧を表示する', async () => {
    renderWithRoute()
    expect(await screen.findByText('Alice')).toBeInTheDocument()
    expect(await screen.findByText('Bob')).toBeInTheDocument()
  })

  it('ホストに👑が付き、非ホストには付かない', async () => {
    renderWithRoute()
    expect(await screen.findByText('Alice')).toBeInTheDocument()
    expect(screen.queryByText('👑 Bob')).not.toBeInTheDocument()
  })

  it('ホストが先頭に表示される', async () => {
    renderWithRoute()
    await screen.findByText('Alice')
    const items = screen.getAllByRole('listitem')
    expect(items[0]).toHaveTextContent('Alice')
    expect(items[1]).toHaveTextContent('Bob')
  })

  it('keeps the invite code readable when the waiting member row is full', async () => {
    mockParticipants.splice(
      0,
      mockParticipants.length,
      { id: 'p-1', auth_id: 'uid-alice', name: 'Alice', session_id: 'sess-1', joined_at: '' },
      { id: 'p-2', auth_id: 'uid-bob', name: 'Bob', session_id: 'sess-1', joined_at: '' },
      { id: 'p-3', auth_id: 'uid-chris', name: 'Chris', session_id: 'sess-1', joined_at: '' },
      { id: 'p-4', auth_id: 'uid-dana', name: 'Dana', session_id: 'sess-1', joined_at: '' },
      { id: 'p-5', auth_id: 'uid-erin', name: 'Erin', session_id: 'sess-1', joined_at: '' },
    )

    renderWithRoute()

    const codeBadge = await screen.findByText('472819')
    expect(codeBadge).toHaveClass('whitespace-nowrap')
    expect(screen.getByLabelText('Aliceのアバター（あなた）').parentElement).toHaveClass('flex-wrap')
  })
})
