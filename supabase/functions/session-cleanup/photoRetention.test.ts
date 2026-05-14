import { describe, expect, it } from 'vitest'
import {
  PHOTO_RETENTION_HOURS,
  getExpiredPhotoCutoffIso,
  selectExpiredEndedPhotos,
} from './photoRetention'

const now = new Date('2026-05-14T12:00:00.000Z')

describe('写真保持期間', () => {
  it('48時間の保持期間を使う', () => {
    expect(PHOTO_RETENTION_HOURS).toBe(48)
    expect(getExpiredPhotoCutoffIso(now)).toBe('2026-05-12T12:00:00.000Z')
  })

  it('終了済みセッションから48時間より古い写真だけを選ぶ', () => {
    const photos = selectExpiredEndedPhotos([
      {
        id: 'ended-old',
        storage_path: 'sess-ended/old.jpg',
        created_at: '2026-05-12T11:59:59.000Z',
        session_status: 'ended',
      },
      {
        id: 'ended-recent',
        storage_path: 'sess-ended/recent.jpg',
        created_at: '2026-05-12T12:00:00.000Z',
        session_status: 'ended',
      },
      {
        id: 'active-old',
        storage_path: 'sess-active/old.jpg',
        created_at: '2026-05-12T11:59:59.000Z',
        session_status: 'active',
      },
    ], now)

    expect(photos).toEqual([
      {
        id: 'ended-old',
        storage_path: 'sess-ended/old.jpg',
        created_at: '2026-05-12T11:59:59.000Z',
        session_status: 'ended',
      },
    ])
  })
})
