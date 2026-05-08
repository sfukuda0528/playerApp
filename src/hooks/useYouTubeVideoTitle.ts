import { useState } from 'react'

export function useYouTubeVideoTitle() {
  const [title, setTitle] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const fetchTitle = async (url: string) => {
    if (!url.trim()) return
    setLoading(true)
    try {
      const params = new URLSearchParams({ url, format: 'json' })
      const res = await fetch(`https://www.youtube.com/oembed?${params}`)
      if (!res.ok) throw new Error('title fetch failed')
      const json = await res.json() as { title: string }
      setTitle(json.title)
    } catch {
      setTitle(null)
    } finally {
      setLoading(false)
    }
  }

  const clear = () => setTitle(null)

  return { title, loading, fetchTitle, clear }
}
