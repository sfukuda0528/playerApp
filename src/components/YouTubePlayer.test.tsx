import { render, screen, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import YouTubePlayer from './YouTubePlayer'

const { mockPlayVideo, mockPauseVideo, ytProps } = vi.hoisted(() => ({
  mockPlayVideo: vi.fn(),
  mockPauseVideo: vi.fn(),
  ytProps: {
    onReady: undefined as ((e: { target: unknown }) => void) | undefined,
    onEnd: undefined as (() => void) | undefined,
    onError: undefined as (() => void) | undefined,
  },
}))

vi.mock('react-youtube', () => ({
  default: (props: {
    videoId: string
    opts?: { playerVars?: { autoplay?: number; list?: string; listType?: string } }
    onReady?: (e: { target: unknown }) => void
    onEnd?: () => void
    onError?: () => void
  }) => {
    ytProps.onReady = props.onReady
    ytProps.onEnd = props.onEnd
    ytProps.onError = props.onError
    props.onReady?.({ target: { playVideo: mockPlayVideo, pauseVideo: mockPauseVideo } })
    return (
      <div
        data-testid="yt-iframe"
        data-video-id={props.videoId}
        data-autoplay={String(props.opts?.playerVars?.autoplay ?? '')}
        data-playlist-id={props.opts?.playerVars?.list ?? ''}
      />
    )
  },
}))

const baseProps = {
  videoId: 'dQw4w9WgXcQ',
  isPlaying: false,
  onPlayToggle: vi.fn(),
  onEnded: vi.fn(),
  onPrev: vi.fn(),
  onNext: vi.fn(),
  hasPrev: true,
  hasNext: true,
}

describe('YouTubePlayer', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    baseProps.onPlayToggle = vi.fn()
    baseProps.onPrev = vi.fn()
    baseProps.onNext = vi.fn()
    baseProps.onEnded = vi.fn()
  })

  it('YouTube iframe を videoId 付きでレンダリング', () => {
    render(<YouTubePlayer {...baseProps} />)
    expect(screen.getByTestId('yt-iframe')).toHaveAttribute('data-video-id', 'dQw4w9WgXcQ')
  })

  it('isPlaying=true のとき playVideo を呼ぶ', () => {
    render(<YouTubePlayer {...baseProps} isPlaying={true} />)
    expect(mockPlayVideo).toHaveBeenCalled()
  })

  it('isPlaying=true で videoId が変わったとき次の動画を自動再生する設定を渡す', () => {
    const { rerender } = render(<YouTubePlayer {...baseProps} isPlaying={true} />)
    rerender(<YouTubePlayer {...baseProps} videoId="nextVideoId" isPlaying={true} />)
    expect(screen.getByTestId('yt-iframe')).toHaveAttribute('data-autoplay', '1')
  })

  it('isPlaying=false のとき pauseVideo を呼ぶ', () => {
    render(<YouTubePlayer {...baseProps} isPlaying={false} />)
    expect(mockPauseVideo).toHaveBeenCalled()
  })

  it('isPlaying=false のとき再生ボタンを表示', () => {
    render(<YouTubePlayer {...baseProps} isPlaying={false} />)
    expect(screen.getByRole('button', { name: '再生' })).toBeInTheDocument()
  })

  it('isPlaying=true のとき停止ボタンを表示', () => {
    render(<YouTubePlayer {...baseProps} isPlaying={true} />)
    expect(screen.getByRole('button', { name: '停止' })).toBeInTheDocument()
  })

  it('再生/停止ボタンクリックで onPlayToggle を呼ぶ', async () => {
    render(<YouTubePlayer {...baseProps} isPlaying={false} />)
    await userEvent.click(screen.getByRole('button', { name: '再生' }))
    expect(baseProps.onPlayToggle).toHaveBeenCalledOnce()
  })

  it('前へボタンクリックで onPrev を呼ぶ', async () => {
    render(<YouTubePlayer {...baseProps} />)
    await userEvent.click(screen.getByRole('button', { name: '前へ' }))
    expect(baseProps.onPrev).toHaveBeenCalledOnce()
  })

  it('次へボタンクリックで onNext を呼ぶ', async () => {
    render(<YouTubePlayer {...baseProps} />)
    await userEvent.click(screen.getByRole('button', { name: '次へ' }))
    expect(baseProps.onNext).toHaveBeenCalledOnce()
  })

  it('hasPrev=false のとき前へボタンが無効', () => {
    render(<YouTubePlayer {...baseProps} hasPrev={false} />)
    expect(screen.getByRole('button', { name: '前へ' })).toBeDisabled()
  })

  it('hasNext=false のとき次へボタンが無効', () => {
    render(<YouTubePlayer {...baseProps} hasNext={false} />)
    expect(screen.getByRole('button', { name: '次へ' })).toBeDisabled()
  })

  it('onError 発火で onError prop を呼ぶ', () => {
    const onError = vi.fn()
    render(<YouTubePlayer {...baseProps} onError={onError} />)
    act(() => { ytProps.onError?.() })
    expect(onError).toHaveBeenCalledOnce()
  })

  it('playlistId が渡されたとき data-playlist-id が設定される', () => {
    render(
      <YouTubePlayer
        playlistId="PLxxx"
        isPlaying={false}
        onPlayToggle={vi.fn()}
        onEnded={vi.fn()}
        onPrev={vi.fn()}
        onNext={vi.fn()}
        hasPrev={false}
        hasNext={false}
      />
    )
    expect(screen.getByTestId('yt-iframe')).toHaveAttribute('data-playlist-id', 'PLxxx')
  })
})
