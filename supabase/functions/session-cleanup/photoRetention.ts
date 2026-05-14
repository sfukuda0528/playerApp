export const PHOTO_RETENTION_HOURS = 48

const PHOTO_RETENTION_MS = PHOTO_RETENTION_HOURS * 60 * 60 * 1000

export type PhotoRetentionCandidate = {
  id: string
  storage_path: string
  created_at: string
  session_status: 'active' | 'ended'
}

export function getExpiredPhotoCutoffIso(now = new Date()) {
  return new Date(now.getTime() - PHOTO_RETENTION_MS).toISOString()
}

export function selectExpiredEndedPhotos(
  photos: PhotoRetentionCandidate[],
  now = new Date()
) {
  const cutoffMs = now.getTime() - PHOTO_RETENTION_MS

  return photos.filter((photo) =>
    photo.session_status === 'ended' &&
    new Date(photo.created_at).getTime() < cutoffMs
  )
}
