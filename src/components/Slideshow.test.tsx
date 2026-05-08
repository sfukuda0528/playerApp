import { render, screen, act, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import Slideshow from './Slideshow'
import type { Photo } from '../types/session'

vi.mock('../lib/supabase', () => ({
  supabase: {
    storage: {
      from: () => ({
        createSignedUrl: (path: string) =>
          Promise.resolve({ data: { signedUrl: `https://example.com/${path}` }, error: null }),
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
  beforeEach(() => {
    vi.useFakeTimers()
    HTMLElement.prototype.requestFullscreen = vi.fn().mockResolvedValue(undefined)
    document.exitFullscreen = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(document, 'fullscreenEnabled', {
      value: true, configurable: true, writable: true,
    })
    Object.defineProperty(document, 'fullscreenElement', {
      value: null, configurable: true, writable: true,
    })
  })

  afterEach(() => {
    vi.useRealTimers()
    Object.defineProperty(document, 'fullscreenElement', {
      value: null, configurable: true, writable: true,
    })
  })

  it('写真なし: プレースホルダーを表示する', () => {
    render(<Slideshow photos={[]} />)
    expect(screen.getByText('写真がまだありません')).toBeInTheDocument()
  })

  it('写真あり: 最初の写真を表示する', async () => {
    await act(async () => {
      render(<Slideshow photos={[photo1, photo2]} />)
    })
    expect(screen.getByRole('img')).toHaveAttribute(
      'src', 'https://example.com/sess-1/001_a.jpg'
    )
    expect(screen.getByText('1 / 2')).toBeInTheDocument()
  })

  it('5秒後: 次の写真へ自動進行する', async () => {
    await act(async () => {
      render(<Slideshow photos={[photo1, photo2]} />)
    })
    act(() => { vi.advanceTimersByTime(5000) })
    expect(screen.getByRole('img')).toHaveAttribute(
      'src', 'https://example.com/sess-1/002_b.jpg'
    )
    expect(screen.getByText('2 / 2')).toBeInTheDocument()
  })

  it('最後の写真から最初に戻る', async () => {
    await act(async () => {
      render(<Slideshow photos={[photo1, photo2]} />)
    })
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

  it('fullscreenEnabled=true: 写真あり時に⛶ボタンを表示する', async () => {
    await act(async () => {
      render(<Slideshow photos={[photo1, photo2]} />)
    })
    expect(screen.getByLabelText('全画面表示')).toBeInTheDocument()
  })

  it('fullscreenEnabled=false: ⛶ボタンを表示しない', async () => {
    Object.defineProperty(document, 'fullscreenEnabled', { value: false, configurable: true, writable: true })
    await act(async () => {
      render(<Slideshow photos={[photo1, photo2]} />)
    })
    expect(screen.queryByLabelText('全画面表示')).not.toBeInTheDocument()
  })

  it('⛶ボタンクリックで requestFullscreen が呼ばれる', async () => {
    await act(async () => {
      render(<Slideshow photos={[photo1, photo2]} />)
    })
    await act(async () => {
      fireEvent.click(screen.getByLabelText('全画面表示'))
    })
    expect(HTMLElement.prototype.requestFullscreen).toHaveBeenCalledTimes(1)
  })
})
