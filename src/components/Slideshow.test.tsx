import { render, screen, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import Slideshow from './Slideshow'
import type { Photo } from '../types/session'

vi.mock('../lib/supabase', () => ({
  supabase: {
    storage: {
      from: () => ({
        getPublicUrl: (path: string) => ({
          data: { publicUrl: `https://example.com/${path}` },
        }),
      }),
    },
  },
}))

const photo1: Photo = {
  id: 'ph-1', session_id: 'sess-1', uploader_auth_id: 'uid-1',
  storage_path: 'sess-1/001_a.jpg', created_at: '2026-04-26T10:00:00Z',
}
const photo2: Photo = {
  id: 'ph-2', session_id: 'sess-1', uploader_auth_id: 'uid-2',
  storage_path: 'sess-1/002_b.jpg', created_at: '2026-04-26T10:01:00Z',
}

describe('Slideshow', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => { vi.useRealTimers() })

  it('写真なし: プレースホルダーを表示する', () => {
    render(<Slideshow photos={[]} />)
    expect(screen.getByText('写真がまだありません')).toBeInTheDocument()
  })

  it('写真あり: 最初の写真を表示する', () => {
    render(<Slideshow photos={[photo1, photo2]} />)
    expect(screen.getByRole('img')).toHaveAttribute(
      'src', 'https://example.com/sess-1/001_a.jpg'
    )
    expect(screen.getByText('1 / 2')).toBeInTheDocument()
  })

  it('5秒後: 次の写真へ自動進行する', () => {
    render(<Slideshow photos={[photo1, photo2]} />)
    act(() => { vi.advanceTimersByTime(5000) })
    expect(screen.getByRole('img')).toHaveAttribute(
      'src', 'https://example.com/sess-1/002_b.jpg'
    )
    expect(screen.getByText('2 / 2')).toBeInTheDocument()
  })

  it('最後の写真から最初に戻る', () => {
    render(<Slideshow photos={[photo1, photo2]} />)
    act(() => { vi.advanceTimersByTime(10000) })
    expect(screen.getByRole('img')).toHaveAttribute(
      'src', 'https://example.com/sess-1/001_a.jpg'
    )
  })

  it('写真が空の場合タイマーは動作しない', () => {
    render(<Slideshow photos={[]} />)
    act(() => { vi.advanceTimersByTime(5000) })
    expect(screen.getByText('写真がまだありません')).toBeInTheDocument()
  })
})
