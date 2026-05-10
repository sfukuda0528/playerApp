import { useEffect, useState, useRef } from 'react'
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors } from '@dnd-kit/core'
import type { DragEndEvent } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faGripVertical, faXmark, faMagnifyingGlass, faList,
} from '@fortawesome/free-solid-svg-icons'
import { faYoutube } from '@fortawesome/free-brands-svg-icons'
import { ListStart, ListEnd } from 'lucide-react'
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
      aria-current={isCurrent ? true : undefined}
      className={`flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm relative overflow-hidden transition-shadow duration-200 bg-white text-camp-dark`}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : isCurrent ? 1 : 0.8,
        ...(isCurrent
          ? { boxShadow: '0 4px 14px rgba(124,74,30,0.16)', border: '1px solid rgba(224,123,57,0.3)' }
          : { boxShadow: '0 2px 8px rgba(124,74,30,0.08)', border: '1px solid rgba(240,200,150,0.4)' }),
      }}
    >
      {isCurrent && (
        <div
          className="absolute left-0 top-0 bottom-0 w-[3px] rounded-l-xl"
          style={{ background: 'linear-gradient(180deg, #e07b39, #c8954a)', animation: 'pulse-glow 2s ease-in-out infinite' }}
        />
      )}
      <button
        type="button"
        aria-label="並び替え"
        {...attributes}
        {...listeners}
        onContextMenu={(e) => e.preventDefault()}
        className="cursor-grab flex-shrink-0 text-camp-brown/30 hover:text-camp-brown/60 transition-colors ml-1 touch-none select-none"
      >
        <FontAwesomeIcon icon={faGripVertical} className="text-sm" />
      </button>
      <span className={`flex-1 truncate text-sm ${isCurrent ? 'font-semibold' : ''}`}>
        {link.title || link.url}
      </span>
      {isCurrent && (
        <span
          className="text-xs text-camp-orange px-2 py-0.5 rounded-md flex-shrink-0"
          style={{ background: 'rgba(224,123,57,0.1)' }}
        >
          再生中
        </span>
      )}
      {link.added_by_auth_id === currentUserId && (
        <button
          type="button"
          aria-label="削除"
          onClick={onDelete}
          disabled={loading}
          className="text-camp-brown/30 hover:text-camp-brown/60 transition-colors flex-shrink-0 disabled:opacity-30"
        >
          <FontAwesomeIcon icon={faXmark} className="text-sm" />
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
    onUpdate: (prevLinks, newLinks) => {
      const idx = currentIndexRef.current
      const currentSongId = prevLinks[idx]?.id
      if (!currentSongId) return
      const newIdx = newLinks.findIndex(l => l.id === currentSongId)
      if (newIdx !== -1 && newIdx !== idx) setCurrentIndex(newIdx)
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

  const currentIndexRef = useRef(0)
  useEffect(() => { currentIndexRef.current = currentIndex }, [currentIndex])

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

    if (newIndex < currentIndex) return

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
        <div
          className="px-4 py-4 flex flex-col gap-3"
          style={{ background: 'linear-gradient(160deg, #1a0800, #3d1c06)' }}
        >
          {(videoId || playlistId) ? (
            <>
              <div className="flex items-center gap-1.5 text-camp-cream/30 text-xs">
                <FontAwesomeIcon icon={faYoutube} className="text-red-400/60 text-sm" />
                <span className="truncate">{links[currentIndex]?.title || '読み込み中...'}</span>
              </div>
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
            </>
          ) : (
            <AmbientPlayer videoId={getAmbientVideoId()} />
          )}
          {skipToast && (
            <p role="status" className="text-camp-wheat text-xs text-center">再生できないためスキップしました</p>
          )}
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
        <div
          className="bg-white rounded-xl p-3"
          style={{ boxShadow: '0 2px 10px rgba(124,74,30,0.08)', border: '1px solid rgba(240,200,150,0.35)' }}
        >
          <Tabs defaultValue="search">
            <TabsList className="w-full bg-camp-wheat/30">
              <TabsTrigger value="search" className="flex-1 text-xs text-camp-brown/60 data-[state=active]:bg-camp-orange data-[state=active]:text-white data-[state=active]:shadow">検索</TabsTrigger>
              <TabsTrigger value="url" className="flex-1 text-xs text-camp-brown/60 data-[state=active]:bg-camp-orange data-[state=active]:text-white data-[state=active]:shadow">URL入力</TabsTrigger>
            </TabsList>

            <TabsContent value="search" className="flex flex-col gap-2 mt-2">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') void search(searchQuery) }}
                  placeholder="曲名・アーティスト名で検索"
                  className="flex-1 bg-camp-warm-white border border-camp-wheat rounded-xl px-3 py-2 text-base text-camp-dark outline-none focus:border-camp-orange focus:ring-2 focus:ring-camp-orange/20 transition-all"
                />
                <button
                  type="button"
                  aria-label="検索"
                  onClick={() => void search(searchQuery)}
                  disabled={searchLoading || !searchQuery.trim()}
                  className="text-white text-sm font-bold px-3 py-2 rounded-xl disabled:opacity-40 active:scale-95 transition-all duration-150"
                  style={{ background: 'linear-gradient(135deg, #e07b39, #c8601a)' }}
                >
                  <FontAwesomeIcon icon={faMagnifyingGlass} />
                </button>
              </div>
              {searchError && <p role="alert" className="text-camp-destructive text-xs">{searchError}</p>}
              {error && <p role="alert" className="text-camp-destructive text-xs">{error}</p>}
              <ul className="flex flex-col gap-1.5">
                {results.map((item) => (
                  <li
                    key={item.videoId}
                    className="flex items-center gap-2 rounded-xl px-2 py-2 bg-white active:shadow-md transition-shadow duration-150"
                    style={{ boxShadow: '0 2px 8px rgba(124,74,30,0.09)', border: '1px solid rgba(240,200,150,0.35)' }}
                  >
                    <img
                      src={item.thumbnail}
                      alt={item.title}
                      className="w-12 h-9 object-cover rounded-lg flex-shrink-0"
                    />
                    <span className="flex-1 text-xs text-camp-dark truncate">{item.title}</span>
                    <button
                      type="button"
                      aria-label={`${item.title}を次に再生`}
                      onClick={() => void handleAddFromSearch(item.videoId, item.title, 'head')}
                      disabled={loading}
                      className="text-xs text-white font-bold px-2 py-1 rounded-lg disabled:opacity-40 flex-shrink-0 active:scale-95 transition-all duration-150 flex items-center gap-1"
                      style={{ background: 'linear-gradient(135deg, #e07b39, #c8601a)' }}
                    >
                      <ListStart size={13} />
                      次に再生
                    </button>
                    <button
                      type="button"
                      aria-label={`${item.title}をキューに追加`}
                      onClick={() => void handleAddFromSearch(item.videoId, item.title, 'tail')}
                      disabled={loading}
                      className="text-xs text-white font-bold px-2 py-1 rounded-lg disabled:opacity-40 flex-shrink-0 active:scale-95 transition-all duration-150 flex items-center gap-1"
                      style={{ background: 'linear-gradient(135deg, #e07b39, #c8601a)' }}
                    >
                      <ListEnd size={13} />
                      キューに追加
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
                className="w-full bg-camp-warm-white border border-camp-wheat rounded-xl px-3 py-2 text-base text-camp-dark outline-none focus:border-camp-orange focus:ring-2 focus:ring-camp-orange/20 transition-all"
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
                  className="flex-1 text-white text-sm font-bold px-3 py-2 rounded-xl disabled:opacity-40 active:scale-95 transition-all duration-150 flex items-center justify-center gap-1.5"
                  style={{ background: 'linear-gradient(135deg, #e07b39, #c8601a)' }}
                >
                  <ListStart size={15} />
                  次に再生
                </button>
                <button
                  type="button"
                  onClick={() => void handleAddFromUrl('tail')}
                  disabled={loading || !!playlistProgress || !urlInput.trim()}
                  className="flex-1 text-white text-sm font-bold px-3 py-2 rounded-xl disabled:opacity-40 active:scale-95 transition-all duration-150 flex items-center justify-center gap-1.5"
                  style={{ background: 'linear-gradient(135deg, #e07b39, #c8601a)' }}
                >
                  <ListEnd size={15} />
                  キューに追加
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

        <div
          className="rounded-xl p-3 flex flex-col gap-2"
          style={{ background: 'linear-gradient(170deg, #fff8f0, #fdf6ec)', boxShadow: '0 2px 10px rgba(124,74,30,0.07)', border: '1px solid rgba(240,200,150,0.4)' }}
        >
          <span className="text-camp-amber text-xs font-bold uppercase tracking-wider flex items-center gap-1.5">
            <FontAwesomeIcon icon={faList} className="text-xs" />
            キュー
          </span>

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
