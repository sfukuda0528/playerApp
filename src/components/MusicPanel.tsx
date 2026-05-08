import { useEffect, useState } from 'react'
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
import YouTubePlayer from './YouTubePlayer'
import { extractYouTubeId, extractPlaylistId } from '../utils/youtube'
import type { MusicLink } from '../types/session'

interface Props {
  sessionId: string
  currentUserId: string
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

export default function MusicPanel({ sessionId, currentUserId, onMusicAdd }: Props) {
  const { links } = useMusicLinks(sessionId, {
    onInsert: (link) => {
      setIsPlaying((prev) => prev || true)
      onMusicAdd?.(link)
    },
  })
  const { addLink, deleteLink, loading, error } = useAddMusicLink()
  const { reorder } = useReorderMusicLink()
  const { results, loading: searchLoading, error: searchError, search } = useYouTubeSearch()
  const { title: fetchedTitle, loading: titleLoading, fetchTitle, clear: clearTitle } = useYouTubeVideoTitle()

  const [currentIndex, setCurrentIndex] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [urlInput, setUrlInput] = useState('')

  const sensors = useSensors(useSensor(PointerSensor))

  useEffect(() => {
    if (links.length === 0 || currentIndex >= links.length) {
      setIsPlaying(false)
      setCurrentIndex(0)
    }
  }, [links.length, currentIndex])

  const handleAddFromSearch = async (videoId: string, title: string, position: 'head' | 'tail') => {
    await addLink(sessionId, `https://www.youtube.com/watch?v=${videoId}`, title, position)
  }

  const handleAddFromUrl = async (position: 'head' | 'tail') => {
    const title = fetchedTitle ?? urlInput
    const ok = await addLink(sessionId, urlInput, title, position)
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

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const oldIndex = links.findIndex(l => l.id === active.id)
    const newIndex = links.findIndex(l => l.id === over.id)
    const sorted = arrayMove(links, oldIndex, newIndex)

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
      <div className="bg-camp-dark px-4 py-4 flex flex-col gap-3">
        {(videoId || playlistId) ? (
          <YouTubePlayer
            key={currentLink?.id ?? 'empty'}
            videoId={videoId ?? undefined}
            playlistId={playlistId ?? undefined}
            isPlaying={isPlaying}
            onPlayToggle={() => setIsPlaying((p) => !p)}
            onEnded={handleEnded}
            onPrev={() => setCurrentIndex((prev) => (prev - 1 + links.length) % links.length)}
            onNext={() => setCurrentIndex((prev) => (prev + 1) % links.length)}
            hasPrev={links.length > 1}
            hasNext={links.length > 1}
          />
        ) : (
          <p className="text-camp-wheat/60 text-sm text-center py-2">曲がキューにありません</p>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-2">
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

        <Tabs defaultValue="search" className="mt-2">
          <TabsList className="w-full bg-camp-cream">
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
                className="flex-1 bg-camp-cream border border-camp-wheat rounded-lg px-3 py-2 text-sm text-camp-dark outline-none focus:border-camp-orange"
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
            <ul className="flex flex-col gap-1">
              {results.map((item) => (
                <li
                  key={item.videoId}
                  className="flex items-center gap-2 rounded-lg px-2 py-1 bg-camp-cream border border-camp-wheat"
                >
                  <img
                    src={item.thumbnail}
                    alt={item.title}
                    className="w-12 h-9 object-cover rounded flex-shrink-0"
                  />
                  <span className="flex-1 text-xs text-camp-dark truncate">{item.title}</span>
                  <button
                    type="button"
                    onClick={() => void handleAddFromSearch(item.videoId, item.title, 'head')}
                    disabled={loading}
                    className="text-xs text-camp-orange font-bold px-2 py-1 rounded hover:bg-camp-orange/10 disabled:opacity-40 flex-shrink-0"
                  >
                    先頭
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleAddFromSearch(item.videoId, item.title, 'tail')}
                    disabled={loading}
                    className="text-xs text-camp-orange font-bold px-2 py-1 rounded hover:bg-camp-orange/10 disabled:opacity-40 flex-shrink-0"
                  >
                    末尾
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
              onBlur={() => { if (urlInput) void fetchTitle(urlInput) }}
              placeholder="YouTube / YouTube Music URL"
              className="w-full bg-camp-cream border border-camp-wheat rounded-lg px-3 py-2 text-sm text-camp-dark outline-none focus:border-camp-orange"
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
                disabled={loading || !urlInput.trim()}
                className="flex-1 bg-camp-orange text-white text-sm font-bold px-3 py-2 rounded-lg disabled:opacity-40"
              >
                先頭に追加
              </button>
              <button
                type="button"
                onClick={() => void handleAddFromUrl('tail')}
                disabled={loading || !urlInput.trim()}
                className="flex-1 bg-camp-orange text-white text-sm font-bold px-3 py-2 rounded-lg disabled:opacity-40"
              >
                末尾に追加
              </button>
            </div>
            {error && <p role="alert" className="text-camp-destructive text-xs">{error}</p>}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
