import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import SessionCreate from './SessionCreate'
import { loadLastSession } from '../utils/lastSession'

const { mockNavigate, mockCreateSession, mockError } = vi.hoisted(() => ({
  mockNavigate: vi.fn(),
  mockCreateSession: vi.fn(),
  mockError: { value: null as string | null },
}))

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return { ...actual, useNavigate: () => mockNavigate }
})
vi.mock('../hooks/useSessionCreate', () => ({
  useSessionCreate: () => ({
    createSession: mockCreateSession,
    loading: false,
    get error() { return mockError.value },
  }),
}))

describe('SessionCreate', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockError.value = null
    localStorage.clear()
  })

  it('名前入力フォームが存在する', () => {
    render(<MemoryRouter><SessionCreate /></MemoryRouter>)
    expect(screen.getByPlaceholderText('ニックネーム')).toBeInTheDocument()
  })

  it('名前が空の場合ボタンが無効', () => {
    render(<MemoryRouter><SessionCreate /></MemoryRouter>)
    expect(screen.getByRole('button', { name: 'セッションを作成' })).toBeDisabled()
  })

  it('成功時: /invite/:sessionIdへ遷移', async () => {
    const fakeSession = { id: 'sess-1', code: '472819' }
    mockCreateSession.mockResolvedValue(fakeSession)

    render(<MemoryRouter><SessionCreate /></MemoryRouter>)
    await userEvent.type(screen.getByPlaceholderText('ニックネーム'), 'Alice')
    await userEvent.click(screen.getByRole('button', { name: 'セッションを作成' }))

    await waitFor(() =>
      expect(mockNavigate).toHaveBeenCalledWith('/invite/sess-1', {
        state: { session: fakeSession },
      })
    )
  })

  it('成功時: 前回セッションとして保存する', async () => {
    const fakeSession = { id: 'sess-1', code: '472819' }
    mockCreateSession.mockResolvedValue(fakeSession)

    render(<MemoryRouter><SessionCreate /></MemoryRouter>)
    await userEvent.type(screen.getByPlaceholderText('ニックネーム'), 'Alice')
    await userEvent.click(screen.getByRole('button', { name: 'セッションを作成' }))

    await waitFor(() => expect(loadLastSession()).toEqual(fakeSession))
  })

  it('失敗時: エラーメッセージを表示', () => {
    mockError.value = 'セッション作成に失敗しました'
    render(<MemoryRouter><SessionCreate /></MemoryRouter>)
    expect(screen.getByRole('alert')).toHaveTextContent('セッション作成に失敗しました')
  })
})
