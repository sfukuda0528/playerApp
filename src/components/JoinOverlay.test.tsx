import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import JoinOverlay from './JoinOverlay'

vi.mock('qrcode', () => ({
  default: { toDataURL: vi.fn().mockResolvedValue('data:image/png;base64,mock') },
}))
vi.mock('../hooks/useParticipants', () => ({
  useParticipants: () => ({ participants: [{ id: 'p-1' }, { id: 'p-2' }] }),
}))

describe('JoinOverlay', () => {
  const onClose = vi.fn()
  const defaultProps = { sessionId: 'sess-1', code: '472819', onClose }

  it('dialog roleで表示される', () => {
    render(<JoinOverlay {...defaultProps} />)
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('6桁コードを表示する', async () => {
    render(<JoinOverlay {...defaultProps} />)
    expect(await screen.findByText('472819')).toBeInTheDocument()
  })

  it('QR画像を表示する', async () => {
    render(<JoinOverlay {...defaultProps} />)
    expect(await screen.findByAltText('QR Code')).toBeInTheDocument()
  })

  it('参加者数を表示する', async () => {
    render(<JoinOverlay {...defaultProps} />)
    expect(await screen.findByText(/2 \/ 4 人/)).toBeInTheDocument()
  })

  it('閉じるボタンクリックでonCloseが呼ばれる', async () => {
    render(<JoinOverlay {...defaultProps} />)
    await userEvent.click(screen.getByRole('button', { name: '閉じる' }))
    expect(onClose).toHaveBeenCalledOnce()
  })
})
