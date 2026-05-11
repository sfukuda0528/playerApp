# MusicPanel キュー位置変更 実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** MusicPanel のスクロールエリア内で、Tabs（検索/URL入力）を上、キューリストを下に並べ替え、それぞれをカードスタイルでラップして視覚的境界を明確にする。

**Architecture:** `MusicPanel.tsx` のレンダリング部分のみ変更。スクロールエリア内のTabs要素とキュー要素の順序を入れ替え、それぞれを背景色の異なる `div` でラップする。ロジックの変更なし。

**Tech Stack:** React, Tailwind CSS (既存カラートークン: `bg-camp-cream`, `bg-camp-warm-white`, `border-camp-wheat`)

---

### Task 1: レイアウト順序のテストを追加

**Files:**
- Modify: `src/components/MusicPanel.test.tsx`

- [ ] **Step 1: 失敗するテストを書く**

`src/components/MusicPanel.test.tsx` の `describe('MusicPanel', ...)` ブロック末尾（line 599 `})` の直前）に以下を追加:

```typescript
  describe('レイアウト順序', () => {
    it('Tabsエリアがキューリストより前（上）に表示される', () => {
      mockLinks.value = [link1]
      render(<MusicPanel sessionId="sess-1" currentUserId="uid-me" />)
      const tabsList = screen.getByRole('tablist')
      const queueItem = screen.getByRole('listitem')
      expect(
        tabsList.compareDocumentPosition(queueItem) & Node.DOCUMENT_POSITION_FOLLOWING
      ).toBeTruthy()
    })
  })
```

- [ ] **Step 2: テストが失敗することを確認**

```bash
npx vitest run src/components/MusicPanel.test.tsx --reporter=verbose 2>&1 | tail -20
```

期待: `Tabsエリアがキューリストより前（上）に表示される` が FAIL

- [ ] **Step 3: コミット（失敗テスト）**

```bash
git add src/components/MusicPanel.test.tsx
git commit -m "test: MusicPanelのレイアウト順序テストを追加（Red）"
```

---

### Task 2: MusicPanel のレイアウトを変更

**Files:**
- Modify: `src/components/MusicPanel.tsx:259-387`

- [ ] **Step 1: スクロールエリア内の JSX を書き換える**

`src/components/MusicPanel.tsx` の line 259〜387（`<div className="flex-1 overflow-y-auto ...">` から閉じ `</div>` まで）を以下に置き換える:

```tsx
      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
        <div className="bg-camp-cream rounded-xl p-3">
          <Tabs defaultValue="search" className="">
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
```

- [ ] **Step 2: 全テストを実行してパスを確認**

```bash
npx vitest run src/components/MusicPanel.test.tsx --reporter=verbose 2>&1 | tail -30
```

期待: 全テスト PASS（新規レイアウト順序テスト含む）

- [ ] **Step 3: コミット**

```bash
git add src/components/MusicPanel.tsx
git commit -m "feat: MusicPanelのキューを検索/URL入力エリアの下に移動し背景色で境界を明確化"
```
