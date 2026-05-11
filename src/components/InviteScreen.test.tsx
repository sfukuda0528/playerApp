import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import InviteScreen from './InviteScreen'

const { mockNavigate } = vi.hoisted(() => ({
  mockNavigate: vi.fn(),
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
    participants: [
      { id: 'p-1', auth_id: 'uid-alice', name: 'Alice', session_id: 'sess-1', joined_at: '' },
      { id: 'p-2', auth_id: 'uid-bob', name: 'Bob', session_id: 'sess-1', joined_at: '' },
    ],
  }),
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
  beforeEach(() => vi.clearAllMocks())

  it('6桁コードを表示する', async () => {
    renderWithRoute()
    expect(await screen.findByText('472819')).toBeInTheDocument()
  })

  it('QR画像を表示する', async () => {
    renderWithRoute()
    expect(await screen.findByAltText('QR Code')).toBeInTheDocument()
  })

  it('参加者数を表示する', async () => {
    renderWithRoute()
    expect(await screen.findByText(/2 \/ 4 人/)).toBeInTheDocument()
  })

  it('スタートボタンクリックで/session/:idへ遷移', async () => {
    renderWithRoute()
    await userEvent.click(await screen.findByRole('button', { name: 'スタート' }))
    expect(mockNavigate).toHaveBeenCalledWith('/session/sess-1', {
      state: { session: fakeSession },
    })
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
})
