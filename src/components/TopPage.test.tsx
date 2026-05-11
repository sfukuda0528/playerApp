import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import TopPage from './TopPage'
import { saveLastSession } from '../utils/lastSession'
import type { Session } from '../types/session'

const { mockNavigate } = vi.hoisted(() => ({
  mockNavigate: vi.fn(),
}))

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return { ...actual, useNavigate: () => mockNavigate }
})

describe('TopPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
  })

  it('「セッション開始」ボタンが存在する', () => {
    render(<MemoryRouter><TopPage /></MemoryRouter>)
    expect(screen.getByRole('button', { name: 'セッション開始' })).toBeInTheDocument()
  })

  it('「セッションに参加」ボタンが存在する', () => {
    render(<MemoryRouter><TopPage /></MemoryRouter>)
    expect(screen.getByRole('button', { name: 'セッションに参加' })).toBeInTheDocument()
  })

  it('「セッション開始」クリックで/createへ遷移', async () => {
    render(<MemoryRouter><TopPage /></MemoryRouter>)
    await userEvent.click(screen.getByRole('button', { name: 'セッション開始' }))
    expect(mockNavigate).toHaveBeenCalledWith('/create')
  })

  it('「セッションに参加」クリックで/joinへ遷移', async () => {
    render(<MemoryRouter><TopPage /></MemoryRouter>)
    await userEvent.click(screen.getByRole('button', { name: 'セッションに参加' }))
    expect(mockNavigate).toHaveBeenCalledWith('/join')
  })

  it('前回セッションがある場合は復帰ボタンが表示され/sessionへ遷移', async () => {
    const session: Session = {
      id: 'sess-1',
      code: '472819',
      host_name: 'Alice',
      host_auth_id: 'uid-host',
      status: 'active',
      last_active_at: '',
      inactivity_timeout_min: 360,
      created_at: '',
    }
    saveLastSession(session)

    render(<MemoryRouter><TopPage /></MemoryRouter>)
    await userEvent.click(screen.getByRole('button', { name: '前回の部屋に戻る' }))

    expect(mockNavigate).toHaveBeenCalledWith('/session/sess-1', {
      state: { session },
    })
  })
})
