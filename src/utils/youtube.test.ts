import { describe, it, expect } from 'vitest'
import { extractYouTubeId, normalizeMusicUrl, extractPlaylistId } from './youtube'

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

describe('normalizeMusicUrl', () => {
  it('music.youtube.com/watch URL を www.youtube.com に変換', () => {
    expect(normalizeMusicUrl('https://music.youtube.com/watch?v=abc'))
      .toBe('https://www.youtube.com/watch?v=abc')
  })
  it('music.youtube.com/playlist URL を www.youtube.com に変換', () => {
    expect(normalizeMusicUrl('https://music.youtube.com/playlist?list=PLxxx'))
      .toBe('https://www.youtube.com/playlist?list=PLxxx')
  })
  it('www.youtube.com URL は変更しない', () => {
    expect(normalizeMusicUrl('https://www.youtube.com/watch?v=abc'))
      .toBe('https://www.youtube.com/watch?v=abc')
  })
  it('youtu.be URL は変更しない', () => {
    expect(normalizeMusicUrl('https://youtu.be/abc'))
      .toBe('https://youtu.be/abc')
  })
})

describe('extractPlaylistId', () => {
  it('playlist URL から list パラメータを抽出', () => {
    expect(extractPlaylistId('https://www.youtube.com/playlist?list=PLxxx')).toBe('PLxxx')
  })
  it('複数パラメータの playlist URL から list を抽出', () => {
    expect(extractPlaylistId('https://www.youtube.com/playlist?list=PLxxx&si=abc')).toBe('PLxxx')
  })
  it('watch URL（list パラメータなし）は null を返す', () => {
    expect(extractPlaylistId('https://www.youtube.com/watch?v=abc')).toBeNull()
  })
  it('youtu.be URL は null を返す', () => {
    expect(extractPlaylistId('https://youtu.be/abc')).toBeNull()
  })
})
