import { describe, it, expect } from 'vitest'
import { getAmbientVideoId, AMBIENT_DAY_ID, AMBIENT_NIGHT_ID } from './ambient'

describe('getAmbientVideoId', () => {
  it('6:00 は昼IDを返す', () => {
    expect(getAmbientVideoId(new Date('2026-05-10T06:00:00'))).toBe(AMBIENT_DAY_ID)
  })
  it('17:59 は昼IDを返す', () => {
    expect(getAmbientVideoId(new Date('2026-05-10T17:59:00'))).toBe(AMBIENT_DAY_ID)
  })
  it('18:00 は夜IDを返す', () => {
    expect(getAmbientVideoId(new Date('2026-05-10T18:00:00'))).toBe(AMBIENT_NIGHT_ID)
  })
  it('5:59 は夜IDを返す', () => {
    expect(getAmbientVideoId(new Date('2026-05-10T05:59:00'))).toBe(AMBIENT_NIGHT_ID)
  })
  it('0:00 は夜IDを返す', () => {
    expect(getAmbientVideoId(new Date('2026-05-10T00:00:00'))).toBe(AMBIENT_NIGHT_ID)
  })
})
