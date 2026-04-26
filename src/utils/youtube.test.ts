import { describe, it, expect } from 'vitest'
import { extractYouTubeId } from './youtube'

describe('extractYouTubeId', () => {
  it('watch URL から ID を抽出', () => {
    expect(extractYouTubeId('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ')
  })
  it('クエリパラメータ付き watch URL から ID を抽出', () => {
    expect(extractYouTubeId('https://www.youtube.com/watch?v=dQw4w9WgXcQ&feature=share')).toBe('dQw4w9WgXcQ')
  })
  it('youtu.be 短縮 URL から ID を抽出', () => {
    expect(extractYouTubeId('https://youtu.be/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ')
  })
  it('youtu.be + クエリパラメータから ID を抽出', () => {
    expect(extractYouTubeId('https://youtu.be/dQw4w9WgXcQ?si=abc')).toBe('dQw4w9WgXcQ')
  })
  it('Spotify URL は null を返す', () => {
    expect(extractYouTubeId('https://open.spotify.com/track/abc')).toBeNull()
  })
  it('無効な文字列は null を返す', () => {
    expect(extractYouTubeId('not a url')).toBeNull()
  })
})
