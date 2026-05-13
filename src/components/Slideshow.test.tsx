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
  let originalRequestFullscreen: typeof HTMLElement.prototype.requestFullscreen

  beforeEach(() => {
    vi.useFakeTimers()
    originalRequestFullscreen = HTMLElement.prototype.requestFullscreen
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
    HTMLElement.prototype.requestFullscreen = originalRequestFullscreen
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

  it('現在表示中写真のアップロード時刻を表示する', async () => {
    await act(async () => {
      render(<Slideshow photos={[photo1, photo2]} />)
    })
    expect(screen.getByText('19:00 にアップロード')).toBeInTheDocument()
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
    expect(screen.getByText('19:01 にアップロード')).toBeInTheDocument()
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

  const enterFullscreen = async (slideshow: HTMLElement) => {
    Object.defineProperty(document, 'fullscreenElement', {
      value: slideshow, configurable: true, writable: true,
    })
    await act(async () => {
      document.dispatchEvent(new Event('fullscreenchange'))
    })
  }

  it('全画面時: ✕ボタン・左右ナビが表示される', async () => {
    await act(async () => {
      render(<Slideshow photos={[photo1, photo2]} />)
    })
    const slideshow = screen.getByLabelText('スライドショー')
    await enterFullscreen(slideshow)
    expect(screen.getByLabelText('全画面を閉じる')).toBeInTheDocument()
    expect(screen.getByLabelText('前の写真')).toBeInTheDocument()
    expect(screen.getByLabelText('次の写真')).toBeInTheDocument()
    expect(screen.queryByLabelText('全画面表示')).not.toBeInTheDocument()
  })

  it('✕クリックで exitFullscreen が呼ばれる', async () => {
    await act(async () => {
      render(<Slideshow photos={[photo1, photo2]} />)
    })
    const slideshow = screen.getByLabelText('スライドショー')
    await enterFullscreen(slideshow)
    await act(async () => {
      fireEvent.click(screen.getByLabelText('全画面を閉じる'))
    })
    expect(document.exitFullscreen).toHaveBeenCalledTimes(1)
  })

  it('‹クリックで前の写真に移動する', async () => {
    await act(async () => {
      render(<Slideshow photos={[photo1, photo2]} />)
    })
    // まず自動で photo2 へ進める
    act(() => { vi.advanceTimersByTime(5000) })
    expect(screen.getByRole('img')).toHaveAttribute('src', 'https://example.com/sess-1/002_b.jpg')
    // 全画面に入る
    const slideshow = screen.getByLabelText('スライドショー')
    await enterFullscreen(slideshow)
    // ‹ クリックで photo1 へ戻る
    await act(async () => {
      fireEvent.click(screen.getByLabelText('前の写真'))
    })
    expect(screen.getByRole('img')).toHaveAttribute('src', 'https://example.com/sess-1/001_a.jpg')
  })

  it('›クリックで次の写真に移動する', async () => {
    await act(async () => {
      render(<Slideshow photos={[photo1, photo2]} />)
    })
    const slideshow = screen.getByLabelText('スライドショー')
    await enterFullscreen(slideshow)
    await act(async () => {
      fireEvent.click(screen.getByLabelText('次の写真'))
    })
    expect(screen.getByRole('img')).toHaveAttribute('src', 'https://example.com/sess-1/002_b.jpg')
  })

  it('手動スキップ後: 5秒タイマーがリセットされる', async () => {
    await act(async () => {
      render(<Slideshow photos={[photo1, photo2]} />)
    })
    const slideshow = screen.getByLabelText('スライドショー')
    await enterFullscreen(slideshow)

    // 3秒進める（まだ photo1）
    act(() => { vi.advanceTimersByTime(3000) })
    expect(screen.getByRole('img')).toHaveAttribute('src', 'https://example.com/sess-1/001_a.jpg')

    // › クリックで photo2 へ（タイマーリセット）
    await act(async () => {
      fireEvent.click(screen.getByLabelText('次の写真'))
    })
    expect(screen.getByRole('img')).toHaveAttribute('src', 'https://example.com/sess-1/002_b.jpg')

    // さらに 3 秒（合計 6 秒経過しているが、リセット後 3 秒なので切り替わらない）
    act(() => { vi.advanceTimersByTime(3000) })
    expect(screen.getByRole('img')).toHaveAttribute('src', 'https://example.com/sess-1/002_b.jpg')

    // さらに 2 秒（リセット後 5 秒 → photo1 へ戻る）
    act(() => { vi.advanceTimersByTime(2000) })
    expect(screen.getByRole('img')).toHaveAttribute('src', 'https://example.com/sess-1/001_a.jpg')
  })
})
