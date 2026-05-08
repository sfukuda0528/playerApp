export function extractYouTubeId(url: string): string | null {
  const watchMatch = url.match(/[?&]v=([^&]+)/)
  if (watchMatch) return watchMatch[1]
  const shortMatch = url.match(/youtu\.be\/([^?&/#]+)/)
  if (shortMatch) return shortMatch[1]
  return null
}

export function normalizeMusicUrl(url: string): string {
  return url.replace(/^(https?:\/\/)music\.youtube\.com/, '$1www.youtube.com')
}

export function extractPlaylistId(url: string): string | null {
  const match = url.match(/[?&]list=([^&]+)/)
  return match ? match[1] : null
}
