import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import AmbientPlayer from './AmbientPlayer'

vi.mock('react-youtube', () => ({
  default: (props: { videoId: string }) => (
    <div data-testid="ambient-youtube" data-video-id={props.videoId} />
  ),
}))

describe('AmbientPlayer', () => {
  it('再生用 YouTube iframe をマウントしたまま画面上では非表示にする', () => {
    render(<AmbientPlayer videoId="ambient-video" />)

    expect(screen.getByTestId('ambient-youtube')).toHaveAttribute('data-video-id', 'ambient-video')
    expect(screen.getByTestId('ambient-player')).toHaveClass('sr-only')
  })
})
