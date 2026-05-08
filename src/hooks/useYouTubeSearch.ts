import { useState } from 'react'

export interface VideoItem {
  videoId: string
  title: string
  thumbnail: string
}

export function useYouTubeSearch() {
  const [results, setResults] = useState<VideoItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const search = async (query: string) => {
    if (!query.trim()) return
    setLoading(true)
    setError(null)
    try {
      const apiKey = import.meta.env.VITE_YOUTUBE_API_KEY as string
      const params = new URLSearchParams({
        part: 'snippet',
        type: 'video',
        maxResults: '10',
        q: query,
        key: apiKey,
      })
      const res = await fetch(`https://www.googleapis.com/youtube/v3/search?${params}`)
      if (!res.ok) throw new Error(`YouTube API error: ${res.status}`)
      const json = await res.json() as {
        items: Array<{
          id: { videoId: string }
          snippet: { title: string; thumbnails: { medium?: { url: string } } }
        }>
      }
      setResults(
        json.items.map((item) => ({
          videoId: item.id.videoId,
          title: item.snippet.title,
          thumbnail:
            item.snippet.thumbnails.medium?.url ??
            `https://img.youtube.com/vi/${item.id.videoId}/mqdefault.jpg`,
        }))
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : '検索に失敗しました')
    } finally {
      setLoading(false)
    }
  }

  const clear = () => setResults([])

  return { results, loading, error, search, clear }
}
