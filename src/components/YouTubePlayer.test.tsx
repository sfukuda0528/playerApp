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
    onReady?: (e: { target: unknown }) => void
    onEnd?: () => void
    onError?: () => void
  }) => {
    ytProps.onReady = props.onReady
    ytProps.onEnd = props.onEnd
    ytProps.onError = props.onError
    props.onReady?.({ target: { playVideo: mockPlayVideo, pauseVideo: mockPauseVideo } })
    return <div data-testid="yt-iframe" data-video-id={props.videoId} />
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

  it('onError 発火でエラーメッセージ表示', () => {
    render(<YouTubePlayer {...baseProps} />)
    act(() => { ytProps.onError?.() })
    expect(screen.getByRole('alert')).toHaveTextContent('再生できません')
  })

  it('videoId 変更でエラーメッセージをリセット', async () => {
    const { rerender } = render(<YouTubePlayer {...baseProps} />)
    act(() => { ytProps.onError?.() })
    expect(screen.getByRole('alert')).toBeInTheDocument()
    rerender(<YouTubePlayer {...baseProps} videoId="newVideoId" />)
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})
