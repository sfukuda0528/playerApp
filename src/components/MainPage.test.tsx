import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import MainPage from './MainPage'

const { mockNavigate, mockEndSession } = vi.hoisted(() => ({
  mockNavigate: vi.fn(),
  mockEndSession: vi.fn(),
}))

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return { ...actual, useNavigate: () => mockNavigate }
})
vi.mock('../hooks/useSessionEnd', () => ({
  useSessionEnd: () => ({ endSession: mockEndSession, loading: false }),
}))
vi.mock('./JoinOverlay', () => ({
  default: ({ onClose }: { onClose: () => void }) => (
    <div role="dialog"><button onClick={onClose}>閉じる</button></div>
  ),
}))

const fakeSession = {
  id: 'sess-1', code: '472819', host_name: 'Alice',
  status: 'active', last_active_at: '', inactivity_timeout_min: 360, created_at: '',
}

function renderWithRoute() {
  return render(
    <MemoryRouter initialEntries={[{ pathname: '/session/sess-1', state: { session: fakeSession } }]}>
      <Routes>
        <Route path="/session/:sessionId" element={<MainPage />} />
      </Routes>
    </MemoryRouter>
  )
}

describe('MainPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(window, 'confirm').mockReturnValue(true)
  })

  it('「＋メンバー」ボタンが存在する', () => {
    renderWithRoute()
    expect(screen.getByRole('button', { name: '＋メンバー' })).toBeInTheDocument()
  })

  it('「＋メンバー」クリックでJoinOverlayが表示される', async () => {
    renderWithRoute()
    await userEvent.click(screen.getByRole('button', { name: '＋メンバー' }))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('JoinOverlayの閉じるでオーバーレイが非表示になる', async () => {
    renderWithRoute()
    await userEvent.click(screen.getByRole('button', { name: '＋メンバー' }))
    await userEvent.click(screen.getByRole('button', { name: '閉じる' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('「セッション終了」確認後にendSessionを呼び/へ遷移', async () => {
    mockEndSession.mockResolvedValue(true)
    renderWithRoute()
    await userEvent.click(screen.getByRole('button', { name: 'セッション終了' }))
    expect(mockEndSession).toHaveBeenCalledWith('sess-1')
    expect(mockNavigate).toHaveBeenCalledWith('/')
  })
})
