import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import SessionJoin from './SessionJoin'
import { loadLastSession } from '../utils/lastSession'

const { mockNavigate, mockJoinSession } = vi.hoisted(() => ({
  mockNavigate: vi.fn(),
  mockJoinSession: vi.fn(),
}))

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return { ...actual, useNavigate: () => mockNavigate }
})
vi.mock('../hooks/useSessionJoin', () => ({
  useSessionJoin: () => ({
    joinSession: mockJoinSession,
    loading: false,
    error: null,
  }),
}))

function renderAtPath(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/join/:code?" element={<SessionJoin />} />
      </Routes>
    </MemoryRouter>
  )
}

describe('SessionJoin', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
  })

  it('URLのコードパラメータをコード欄に自動入力', () => {
    renderAtPath('/join/472819')
    expect(screen.getByDisplayValue('472819')).toBeInTheDocument()
  })

  it('コードと名前が空の場合ボタンが無効', () => {
    renderAtPath('/join')
    expect(screen.getByRole('button', { name: '参加する' })).toBeDisabled()
  })

  it('成功時: /session/:idへ遷移', async () => {
    const fakeResult = {
      session: { id: 'sess-1', code: '472819' },
      participant: { id: 'p-2' },
    }
    mockJoinSession.mockResolvedValue(fakeResult)

    renderAtPath('/join/472819')
    await userEvent.type(screen.getByPlaceholderText('ニックネーム'), 'Bob')
    await userEvent.click(screen.getByRole('button', { name: '参加する' }))

    await waitFor(() =>
      expect(mockNavigate).toHaveBeenCalledWith('/session/sess-1', {
        state: { session: fakeResult.session },
      })
    )
  })

  it('成功時: 前回セッションとして保存する', async () => {
    const fakeResult = {
      session: { id: 'sess-1', code: '472819' },
      participant: { id: 'p-2' },
    }
    mockJoinSession.mockResolvedValue(fakeResult)

    renderAtPath('/join/472819')
    await userEvent.type(screen.getByPlaceholderText('ニックネーム'), 'Bob')
    await userEvent.click(screen.getByRole('button', { name: '参加する' }))

    await waitFor(() => expect(loadLastSession()).toEqual(fakeResult.session))
  })
})
