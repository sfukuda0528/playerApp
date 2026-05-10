import { useEffect, useState, useRef } from 'react'
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors } from '@dnd-kit/core'
import type { DragEndEvent } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Tabs, TabsList, TabsTrigger, TabsContent } from './ui/tabs'
import { useMusicLinks } from '../hooks/useMusicLinks'
import { useAddMusicLink } from '../hooks/useAddMusicLink'
import { useReorderMusicLink } from '../hooks/useReorderMusicLink'
import { useYouTubeSearch } from '../hooks/useYouTubeSearch'
import { useYouTubeVideoTitle } from '../hooks/useYouTubeVideoTitle'
import { usePlaylistItems } from '../hooks/usePlaylistItems'
import YouTubePlayer from './YouTubePlayer'
import AmbientPlayer from './AmbientPlayer'
import { extractYouTubeId, extractPlaylistId } from '../utils/youtube'
import { getAmbientVideoId } from '../utils/ambient'
import type { MusicLink } from '../types/session'

interface Props {
  sessionId: string
  currentUserId: string
  isHost?: boolean
  onMusicAdd?: (link: MusicLink) => void
}

function SortableQueueItem({
  link, index, currentIndex, currentUserId, loading, onDelete,
}: {
  link: MusicLink
  index: number
  currentIndex: number
  currentUserId: string
  loading: boolean
  onDelete: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: link.id })
  const isCurrent = index === currentIndex
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 }}
      aria-current={isCurrent ? true : undefined}
      className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm ${
        isCurrent
          ? 'bg-camp-orange text-white'
          : 'bg-camp-warm-white border border-camp-wheat text-camp-dark'
      }`}
    >
      <button
        type="button"
        aria-label="並び替え"
        {...attributes}
        {...listeners}
        className="cursor-grab flex-shrink-0 opacity-40 hover:opacity-80"
      >
        ⠿
      </button>
      <span className="flex-1 truncate">{link.title || link.url}</span>
      {link.added_by_auth_id === currentUserId && (
        <button
          type="button"
          aria-label="削除"
          onClick={onDelete}
          disabled={loading}
          className="text-xs opacity-70 hover:opacity-100 flex-shrink-0"
        >
          ✕
        </button>
      )}
    </li>
  )
}

export default function MusicPanel({ sessionId, currentUserId, isHost = false, onMusicAdd }: Props) {
  const { links, optimisticReorder } = useMusicLinks(sessionId, {
    onInsert: (link, prevLinks) => {
      const newSortedLinks = [...prevLinks, link].sort((a, b) => a.sort_order - b.sort_order)
      const insertedAt = newSortedLinks.findIndex(l => l.id === link.id)
      if (prevLinks.length > 0) {
        setCurrentIndex((prev) => insertedAt <= prev ? prev + 1 : prev)
      }
      setIsPlaying(true)
      onMusicAdd?.(link)
    },
  })
  const { addLink, addLinks, deleteLink, loading, error } = useAddMusicLink()
  const { reorder } = useReorderMusicLink()
  const { results, loading: searchLoading, error: searchError, search } = useYouTubeSearch()
  const { title: fetchedTitle, loading: titleLoading, fetchTitle, clear: clearTitle } = useYouTubeVideoTitle()
  const { fetchPlaylistItems, error: playlistError } = usePlaylistItems()

  const [currentIndex, setCurrentIndex] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [urlInput, setUrlInput] = useState('')
  const [playlistProgress, setPlaylistProgress] = useState<{ phase: 'fetching' | 'inserting'; total: number } | null>(null)
  const [skipToast, setSkipToast] = useState(false)

  const skipToastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const sensors = useSensors(useSensor(PointerSensor))

  useEffect(() => {
    if (links.length === 0 || currentIndex >= links.length) {
      setIsPlaying(false)
      setCurrentIndex(0)
    }
  }, [links.length, currentIndex])

  useEffect(() => {
    return () => {
      if (skipToastTimerRef.current) clearTimeout(skipToastTimerRef.current)
    }
  }, [])

  const handleAddFromSearch = async (videoId: string, title: string, position: 'head' | 'tail') => {
    const url = `https://www.youtube.com/watch?v=${videoId}`
    if (position === 'head' && currentLink) {
      const nextLink = links[currentIndex + 1]
      const sortOrder = nextLink
        ? (currentLink.sort_order + nextLink.sort_order) / 2
        : currentLink.sort_order + 1000
      await addLink(sessionId, url, title, position, sortOrder)
    } else {
      await addLink(sessionId, url, title, position)
    }
  }

  const handleAddFromUrl = async (position: 'head' | 'tail') => {
    const videoId = extractYouTubeId(urlInput)
    const playlistId = extractPlaylistId(urlInput)

    if (playlistId && !videoId) {
      setPlaylistProgress({ phase: 'fetching', total: 0 })
      const items = await fetchPlaylistItems(playlistId)
      if (!items) {
        setPlaylistProgress(null)
        return
      }
      setPlaylistProgress({ phase: 'inserting', total: items.length })
      const musicItems = items.map(item => ({
        url: `https://www.youtube.com/watch?v=${item.videoId}`,
        title: item.title,
      }))
      const nextLink = position === 'head' ? links[currentIndex + 1] : undefined
      // position='head' with empty queue: currentLink is undefined, addLinks falls back to tail
      const ok = await addLinks(
        sessionId,
        musicItems,
        position,
        position === 'head' ? currentLink : undefined,
        nextLink
      )
      setPlaylistProgress(null)
      if (ok) setUrlInput('')
      return
    }

    const title = fetchedTitle ?? urlInput
    let ok: boolean
    if (position === 'head' && currentLink) {
      const nextLink = links[currentIndex + 1]
      const sortOrder = nextLink
        ? (currentLink.sort_order + nextLink.sort_order) / 2
        : currentLink.sort_order + 1000
      ok = await addLink(sessionId, urlInput, title, position, sortOrder)
    } else {
      ok = await addLink(sessionId, urlInput, title, position)
    }
    if (ok) {
      setUrlInput('')
      clearTitle()
    }
  }

  const handleDelete = async (link: MusicLink, index: number) => {
    const isCurrent = index === currentIndex
    const ok = await deleteLink(link.id)
    if (!ok) return
    if (isCurrent) {
      setIsPlaying(false)
      setCurrentIndex(0)
    } else if (index < currentIndex) {
      setCurrentIndex((prev) => prev - 1)
    }
  }

  const handleEnded = async () => {
    if (!currentLink) return
    await deleteLink(currentLink.id)
  }

  const handleError = () => {
    if (!currentLink) return
    if (skipToastTimerRef.current) clearTimeout(skipToastTimerRef.current)
    setSkipToast(true)
    void deleteLink(currentLink.id)
    skipToastTimerRef.current = setTimeout(() => setSkipToast(false), 3000)
  }

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const oldIndex = links.findIndex(l => l.id === active.id)
    const newIndex = links.findIndex(l => l.id === over.id)
    const sorted = arrayMove(links, oldIndex, newIndex)

    optimisticReorder(sorted)

    const currentLinkId = links[currentIndex]?.id
    if (currentLinkId) {
      const newCurrentIndex = sorted.findIndex(l => l.id === currentLinkId)
      if (newCurrentIndex !== currentIndex) setCurrentIndex(newCurrentIndex)
    }

    const prev = sorted[newIndex - 1]
    const next = sorted[newIndex + 1]

    let newSortOrder: number
    if (!prev && next) {
      newSortOrder = next.sort_order - 1000
    } else if (prev && !next) {
      newSortOrder = prev.sort_order + 1000
    } else if (prev && next) {
      newSortOrder = (prev.sort_order + next.sort_order) / 2
    } else {
      newSortOrder = 0
    }

    await reorder(active.id as string, newSortOrder)
  }

  const currentLink = links[currentIndex]
  const videoId = currentLink ? extractYouTubeId(currentLink.url) : null
  const playlistId = !videoId && currentLink ? extractPlaylistId(currentLink.url) : null

  return (
    <div className="flex flex-col h-full">
      {isHost && (
        <div className="bg-camp-dark px-4 py-4 flex flex-col gap-3">
          {(videoId || playlistId) ? (
            <YouTubePlayer
              key={currentLink?.id ?? 'empty'}
              videoId={videoId ?? undefined}
              playlistId={playlistId ?? undefined}
              isPlaying={isPlaying}
              onPlayToggle={() => setIsPlaying((p) => !p)}
              onEnded={handleEnded}
              onError={handleError}
              onPrev={() => setCurrentIndex((prev) => (prev - 1 + links.length) % links.length)}
              onNext={handleEnded}
              hasPrev={links.length > 1}
              hasNext={links.length > 1}
            />
          ) : (
            <AmbientPlayer videoId={getAmbientVideoId()} />
          )}
          {skipToast && (
            <p role="status" className="text-camp-wheat text-xs text-center">再生できないためスキップしました</p>
          )}
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
        <div className="bg-camp-cream rounded-xl p-3">
          <Tabs defaultValue="search">
            <TabsList className="w-full bg-camp-warm-white">
              <TabsTrigger value="search" className="flex-1 text-xs">検索</TabsTrigger>
              <TabsTrigger value="url" className="flex-1 text-xs">URL入力</TabsTrigger>
            </TabsList>

            <TabsContent value="search" className="flex flex-col gap-2 mt-2">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') void search(searchQuery) }}
                  placeholder="曲名・アーティスト名で検索"
                  className="flex-1 bg-camp-warm-white border border-camp-wheat rounded-lg px-3 py-2 text-base text-camp-dark outline-none focus:border-camp-orange"
                />
                <button
                  type="button"
                  onClick={() => void search(searchQuery)}
                  disabled={searchLoading || !searchQuery.trim()}
                  className="bg-camp-orange text-white text-sm font-bold px-3 py-2 rounded-lg disabled:opacity-40"
                >
                  🔍
                </button>
              </div>
              {searchError && <p role="alert" className="text-camp-destructive text-xs">{searchError}</p>}
              {error && <p role="alert" className="text-camp-destructive text-xs">{error}</p>}
              <ul className="flex flex-col gap-1">
                {results.map((item) => (
                  <li
                    key={item.videoId}
                    className="flex items-center gap-2 rounded-lg px-2 py-1 bg-camp-warm-white border border-camp-wheat"
                  >
                    <img
                      src={item.thumbnail}
                      alt={item.title}
                      className="w-12 h-9 object-cover rounded flex-shrink-0"
                    />
                    <span className="flex-1 text-xs text-camp-dark truncate">{item.title}</span>
                    <button
                      type="button"
                      aria-label={`${item.title}を先頭に追加`}
                      onClick={() => void handleAddFromSearch(item.videoId, item.title, 'head')}
                      disabled={loading}
                      className="text-xs bg-camp-orange text-white font-bold px-2 py-1 rounded hover:bg-camp-orange/80 disabled:opacity-40 flex-shrink-0"
                    >
                      先頭に追加
                    </button>
                    <button
                      type="button"
                      aria-label={`${item.title}を末尾に追加`}
                      onClick={() => void handleAddFromSearch(item.videoId, item.title, 'tail')}
                      disabled={loading}
                      className="text-xs bg-camp-orange text-white font-bold px-2 py-1 rounded hover:bg-camp-orange/80 disabled:opacity-40 flex-shrink-0"
                    >
                      末尾に追加
                    </button>
                  </li>
                ))}
              </ul>
            </TabsContent>

            <TabsContent value="url" className="flex flex-col gap-2 mt-2">
              <input
                type="text"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                onBlur={() => { if (urlInput && !extractPlaylistId(urlInput)) void fetchTitle(urlInput) }}
                placeholder="YouTube / YouTube Music URL"
                className="w-full bg-camp-warm-white border border-camp-wheat rounded-lg px-3 py-2 text-base text-camp-dark outline-none focus:border-camp-orange"
              />
              {titleLoading && (
                <p className="text-camp-wheat text-xs">タイトル取得中...</p>
              )}
              {fetchedTitle && (
                <p className="text-camp-dark text-xs truncate">タイトル: {fetchedTitle}</p>
              )}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => void handleAddFromUrl('head')}
                  disabled={loading || !!playlistProgress || !urlInput.trim()}
                  className="flex-1 bg-camp-orange text-white text-sm font-bold px-3 py-2 rounded-lg disabled:opacity-40"
                >
                  先頭に追加
                </button>
                <button
                  type="button"
                  onClick={() => void handleAddFromUrl('tail')}
                  disabled={loading || !!playlistProgress || !urlInput.trim()}
                  className="flex-1 bg-camp-orange text-white text-sm font-bold px-3 py-2 rounded-lg disabled:opacity-40"
                >
                  末尾に追加
                </button>
              </div>
              {playlistProgress && (
                <p className="text-camp-wheat text-xs">
                  {playlistProgress.phase === 'fetching'
                    ? 'プレイリスト取得中...'
                    : `${playlistProgress.total}件をキューに追加中...`}
                </p>
              )}
              {(error ?? playlistError) && (
                <p role="alert" className="text-camp-destructive text-xs">{error ?? playlistError}</p>
              )}
            </TabsContent>
          </Tabs>
        </div>

        <div className="bg-camp-warm-white border border-camp-wheat rounded-xl p-3 flex flex-col gap-2">
          <span className="text-camp-amber text-xs font-bold uppercase tracking-wider">キュー</span>

          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={links.map(l => l.id)} strategy={verticalListSortingStrategy}>
              <ul className="flex flex-col gap-2">
                {links.map((link, index) => (
                  <SortableQueueItem
                    key={link.id}
                    link={link}
                    index={index}
                    currentIndex={currentIndex}
                    currentUserId={currentUserId}
                    loading={loading}
                    onDelete={() => handleDelete(link, index)}
                  />
                ))}
              </ul>
            </SortableContext>
          </DndContext>
        </div>
      </div>
    </div>
  )
}
