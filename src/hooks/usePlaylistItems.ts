import { useState } from 'react'

export interface PlaylistItem {
  videoId: string
  title: string
}

export function usePlaylistItems() {
  const [error, setError] = useState<string | null>(null)

  const fetchPlaylistItems = async (playlistId: string): Promise<PlaylistItem[] | null> => {
    setError(null)
    try {
      const apiKey = import.meta.env.VITE_YOUTUBE_API_KEY as string
      const params = new URLSearchParams({
        part: 'snippet',
        maxResults: '50',
        playlistId,
        key: apiKey,
      })
      const res = await fetch(`https://www.googleapis.com/youtube/v3/playlistItems?${params}`)
      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: { message?: string } }
        throw new Error(body.error?.message ?? `YouTube API error: ${res.status}`)
      }
      const json = await res.json() as {
        items: Array<{
          snippet: { title: string; resourceId: { videoId: string } }
        }>
      }
      if (json.items.length === 0) {
        setError('プレイリストに動画がありません')
        return null
      }
      return json.items.map(item => ({
        videoId: item.snippet.resourceId.videoId,
        title: item.snippet.title,
      }))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'プレイリストの取得に失敗しました')
      return null
    }
  }

  return { fetchPlaylistItems, error }
}
