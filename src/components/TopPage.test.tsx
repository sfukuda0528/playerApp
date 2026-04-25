import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect, vi } from 'vitest'
import TopPage from './TopPage'

const { mockNavigate } = vi.hoisted(() => ({
  mockNavigate: vi.fn(),
}))

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return { ...actual, useNavigate: () => mockNavigate }
})

describe('TopPage', () => {
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
})
