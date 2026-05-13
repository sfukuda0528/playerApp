import { useEffect, useState, useRef } from 'react'
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors } from '@dnd-kit/core'
import type { DragEndEvent } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faGripVertical, faXmark, faMagnifyingGlass, faList, faChevronDown,
} from '@fortawesome/free-solid-svg-icons'
import { faYoutube } from '@fortawesome/free-brands-svg-icons'
import { ListStart, ListEnd, Plus } from 'lucide-react'
import { Tabs, TabsList, TabsTrigger, TabsContent } from './ui/tabs'
import { useMusicLinks } from '../hooks/useMusicLinks'
import { useAddMusicLink } from '../hooks/useAddMusicLink'
import { useReorderMusicLink } from '../hooks/useReorderMusicLink'
import { useMusicPlaybackState } from '../hooks/useMusicPlaybackState'
import { useYouTubeSearch } from '../hooks/useYouTubeSearch'
import type { VideoItem } from '../hooks/useYouTubeSearch'
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
  link, index, currentIndex, currentUserId, isHost, loading, onDelete,
}: {
  link: MusicLink
  index: number
  currentIndex: number
  currentUserId: string
  isHost: boolean
  loading: boolean
  onDelete: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: link.id })
  const isCurrent = index === currentIndex
  const canDelete = isHost || link.added_by_auth_id === currentUserId
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
      {canDelete && (
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
  const { links, optimisticReorder, optimisticDelete } = useMusicLinks(sessionId, {
    onInsert: (link) => {
      onMusicAdd?.(link)
    },
  })
  const { state: playbackState, error: playbackError, setCurrent, setPlaying } = useMusicPlaybackState(sessionId)
  const { addLink, addLinks, deleteLink, loading, error } = useAddMusicLink()
  const { reorder } = useReorderMusicLink()
  const { results, loading: searchLoading, error: searchError, search } = useYouTubeSearch()
  const { title: fetchedTitle, loading: titleLoading, fetchTitle, clear: clearTitle } = useYouTubeVideoTitle()
  const { fetchPlaylistItems, error: playlistError } = usePlaylistItems()

  const [searchQuery, setSearchQuery] = useState('')
  const [urlInput, setUrlInput] = useState('')
  const [selectedSearchItem, setSelectedSearchItem] = useState<VideoItem | null>(null)
  const [playlistProgress, setPlaylistProgress] = useState<{ phase: 'fetching' | 'inserting'; total: number } | null>(null)
  const [skipToast, setSkipToast] = useState(false)

  const skipToastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const sensors = useSensors(useSensor(PointerSensor))
  const playbackCurrentIndex = playbackState?.current_music_link_id
    ? links.findIndex(link => link.id === playbackState.current_music_link_id)
    : -1
  const currentIndex = playbackCurrentIndex >= 0
    ? playbackCurrentIndex
    : (isHost && links.length > 0 ? 0 : -1)
  const currentLink = currentIndex >= 0 ? links[currentIndex] : undefined
  const isPlaying = playbackState?.is_playing ?? false

  useEffect(() => {
    if (!isHost) return
    if (links.length === 0) {
      if (playbackState?.current_music_link_id || playbackState?.is_playing) {
        void setCurrent(null, false)
      }
      return
    }
    const currentId = playbackState?.current_music_link_id
    if (!currentId || !links.some(link => link.id === currentId)) {
      void setCurrent(links[0].id, true)
    }
  }, [isHost, links, playbackState?.current_music_link_id, playbackState?.is_playing, setCurrent])

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
    const isCurrent = link.id === currentLink?.id
    if (isCurrent && isHost) {
      const nextLink = links[index + 1] ?? links[index - 1] ?? null
      const okState = await setCurrent(nextLink?.id ?? null, !!nextLink)
      if (!okState) return
    }
    const ok = await deleteLink(link.id)
    if (!ok) return
    optimisticDelete(link.id)
  }

  const handleEnded = async () => {
    if (!currentLink) return
    const nextLink = links[currentIndex + 1] ?? null
    const okState = await setCurrent(nextLink?.id ?? null, !!nextLink)
    if (!okState) return
    const ok = await deleteLink(currentLink.id)
    if (ok) optimisticDelete(currentLink.id)
  }

  const handleError = () => {
    if (!currentLink) return
    if (skipToastTimerRef.current) clearTimeout(skipToastTimerRef.current)
    setSkipToast(true)
    const nextLink = links[currentIndex + 1] ?? null
    void setCurrent(nextLink?.id ?? null, !!nextLink).then((okState) => {
      if (!okState) return
      void deleteLink(currentLink.id).then((ok) => {
        if (ok) optimisticDelete(currentLink.id)
      })
    })
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
                onPlayToggle={() => void setPlaying(!isPlaying)}
                onEnded={handleEnded}
                onError={handleError}
                onPrev={() => {
                  if (links.length === 0) return
                  const prevIndex = currentIndex > 0 ? currentIndex - 1 : links.length - 1
                  void setCurrent(links[prevIndex].id, true)
                }}
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
        <details
          open
          className="group rounded-xl p-3"
          style={{ background: 'linear-gradient(170deg, #fff8f0, #fdf6ec)', boxShadow: '0 2px 10px rgba(124,74,30,0.07)', border: '1px solid rgba(240,200,150,0.4)' }}
        >
          <summary className="list-none cursor-pointer select-none text-camp-amber text-xs font-bold uppercase tracking-wider flex items-center justify-between gap-2 [&::-webkit-details-marker]:hidden">
            <span className="flex items-center gap-1.5">
              <FontAwesomeIcon icon={faList} className="text-xs" />
              キュー
              <span className="text-camp-brown/45 font-semibold normal-case tracking-normal">
                {links.length}曲
              </span>
            </span>
            <FontAwesomeIcon icon={faChevronDown} className="text-[10px] text-camp-brown/40 transition-transform group-open:rotate-180" />
          </summary>

          <div className="mt-2">
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
                      isHost={isHost}
                      loading={loading}
                      onDelete={() => handleDelete(link, index)}
                    />
                  ))}
                </ul>
              </SortableContext>
            </DndContext>
          </div>
        </details>

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
                <div className="relative flex-1">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') void search(searchQuery) }}
                    placeholder="曲名・アーティスト名で検索"
                    className="w-full bg-camp-warm-white border border-camp-wheat rounded-xl pl-3 pr-9 py-2 text-base text-camp-dark outline-none focus:border-camp-orange focus:ring-2 focus:ring-camp-orange/20 transition-all"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      aria-label="検索欄をクリア"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => setSearchQuery('')}
                      className="absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full text-camp-brown/45 hover:text-camp-brown hover:bg-camp-wheat/30 active:scale-95 transition-all flex items-center justify-center"
                    >
                      <FontAwesomeIcon icon={faXmark} />
                    </button>
                  )}
                </div>
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
              {(error ?? playbackError) && <p role="alert" className="text-camp-destructive text-xs">{error ?? playbackError}</p>}
              <ul className="flex flex-col gap-1.5">
                {results.map((item) => (
                  <li
                    key={item.videoId}
                    className="flex items-start gap-2 rounded-xl px-2 py-2 bg-white active:shadow-md transition-shadow duration-150"
                    style={{ boxShadow: '0 2px 8px rgba(124,74,30,0.09)', border: '1px solid rgba(240,200,150,0.35)' }}
                  >
                    <img
                      src={item.thumbnail}
                      alt={item.title}
                      className="w-12 h-9 object-cover rounded-lg flex-shrink-0"
                    />
                    <div className="flex-1 min-w-0 pt-0.5">
                      <span className="block text-xs text-camp-dark truncate">{item.title}</span>
                      {item.channelTitle && (
                        <span className="block text-[11px] text-camp-brown/55 truncate mt-0.5">
                          {item.channelTitle}
                        </span>
                      )}
                    </div>
                    <button
                      type="button"
                      aria-label={`${item.title}の追加方法を表示`}
                      onClick={() => setSelectedSearchItem(item)}
                      disabled={loading}
                      className="sm:hidden text-white w-8 h-8 rounded-lg disabled:opacity-40 flex-shrink-0 active:scale-95 transition-all duration-150 flex items-center justify-center"
                      style={{ background: 'linear-gradient(135deg, #e07b39, #c8601a)' }}
                    >
                      <Plus size={16} />
                    </button>
                    <button
                      type="button"
                      aria-label={`${item.title}を次に再生`}
                      onClick={() => void handleAddFromSearch(item.videoId, item.title, 'head')}
                      disabled={loading}
                      className="hidden sm:flex text-xs text-white font-bold px-2 py-1 rounded-lg disabled:opacity-40 flex-shrink-0 active:scale-95 transition-all duration-150 items-center gap-1"
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
                      className="hidden sm:flex text-xs text-white font-bold px-2 py-1 rounded-lg disabled:opacity-40 flex-shrink-0 active:scale-95 transition-all duration-150 items-center gap-1"
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
              <div className="relative">
                <input
                  type="text"
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  onBlur={() => { if (urlInput && !extractPlaylistId(urlInput)) void fetchTitle(urlInput) }}
                  placeholder="YouTube / YouTube Music URL"
                  className="w-full bg-camp-warm-white border border-camp-wheat rounded-xl pl-3 pr-9 py-2 text-base text-camp-dark outline-none focus:border-camp-orange focus:ring-2 focus:ring-camp-orange/20 transition-all"
                />
                {urlInput && (
                  <button
                    type="button"
                    aria-label="URL入力欄をクリア"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      setUrlInput('')
                      clearTitle()
                    }}
                    className="absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full text-camp-brown/45 hover:text-camp-brown hover:bg-camp-wheat/30 active:scale-95 transition-all flex items-center justify-center"
                  >
                    <FontAwesomeIcon icon={faXmark} />
                  </button>
                )}
              </div>
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
              {(error ?? playbackError ?? playlistError) && (
                <p role="alert" className="text-camp-destructive text-xs">{error ?? playbackError ?? playlistError}</p>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </div>
      {selectedSearchItem && (
        <div className="fixed inset-0 z-50 sm:hidden flex items-end justify-center bg-black/40 px-4 py-5">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="search-action-dialog-title"
            className="w-full max-w-sm rounded-xl bg-white p-4 shadow-2xl"
          >
            <div className="flex items-start justify-between gap-3">
              <button
                type="button"
                aria-label="閉じる"
                onClick={() => setSelectedSearchItem(null)}
                className="w-8 h-8 rounded-lg text-camp-brown/60 bg-camp-wheat/30 flex items-center justify-center active:scale-95 transition-all"
              >
                <FontAwesomeIcon icon={faXmark} />
              </button>
            </div>

            <div className="mt-3 flex gap-3">
              {selectedSearchItem.thumbnail && (
                <img
                  src={selectedSearchItem.thumbnail}
                  alt={selectedSearchItem.title}
                  className="w-28 h-[63px] object-cover rounded-lg flex-shrink-0"
                />
              )}
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-camp-dark leading-snug">
                  {selectedSearchItem.title}
                </p>
                <p className="text-xs text-camp-brown/60 mt-1">
                  {selectedSearchItem.channelTitle ?? 'チャンネル名不明'}
                </p>
              </div>
            </div>

            <div className="mt-4 flex flex-col gap-2">
              <button
                type="button"
                aria-label={`${selectedSearchItem.title}を次に再生（ダイアログ）`}
                onClick={() => {
                  void handleAddFromSearch(selectedSearchItem.videoId, selectedSearchItem.title, 'head')
                  setSelectedSearchItem(null)
                }}
                disabled={loading}
                className="w-full justify-center text-sm text-white font-bold px-3 py-2.5 rounded-xl disabled:opacity-40 active:scale-95 transition-all duration-150 flex items-center gap-1.5"
                style={{ background: 'linear-gradient(135deg, #e07b39, #c8601a)' }}
              >
                <ListStart size={15} />
                次に再生
              </button>
              <button
                type="button"
                aria-label={`${selectedSearchItem.title}をキューに追加（ダイアログ）`}
                onClick={() => {
                  void handleAddFromSearch(selectedSearchItem.videoId, selectedSearchItem.title, 'tail')
                  setSelectedSearchItem(null)
                }}
                disabled={loading}
                className="w-full justify-center text-sm text-white font-bold px-3 py-2.5 rounded-xl disabled:opacity-40 active:scale-95 transition-all duration-150 flex items-center gap-1.5"
                style={{ background: 'linear-gradient(135deg, #e07b39, #c8601a)' }}
              >
                <ListEnd size={15} />
                キューに追加
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
