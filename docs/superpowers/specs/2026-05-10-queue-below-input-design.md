# MusicPanel レイアウト変更: キューを入力エリア下へ移動

## 概要

`MusicPanel` のスクロールエリア内で、Tabs（検索/URL入力）とキューリストの順序を入れ替え、それぞれを背景色の異なるカードでラップして視覚的な境界を明確にする。

## 変更対象

- `src/components/MusicPanel.tsx` のみ

## 現在のレイアウト（スクロールエリア内）

```
キューラベル + キューリスト
Tabs（検索 / URL入力）
```

## 変更後のレイアウト

```
┌─────────────────────────────┐  bg-camp-cream / rounded-xl / p-3
│  Tabs（検索 / URL入力）     │
└─────────────────────────────┘

┌─────────────────────────────┐  bg-camp-warm-white / border-camp-wheat / rounded-xl / p-3
│  キュー                      │
│  （キューリスト）            │
└─────────────────────────────┘
```

## 実装詳細

### スクロールコンテナ
```
className="flex-1 overflow-y-auto p-4 flex flex-col gap-4"
```
gap を `2` → `4` に変更してセクション間の余白を強調。

### Tabs カード
```jsx
<div className="bg-camp-cream rounded-xl p-3">
  <Tabs ...>...</Tabs>
</div>
```

### キューカード
```jsx
<div className="bg-camp-warm-white border border-camp-wheat rounded-xl p-3 flex flex-col gap-2">
  <span className="text-camp-amber text-xs font-bold uppercase tracking-wider">キュー</span>
  <DndContext ...>...</DndContext>
</div>
```

## スコープ外

- YouTubePlayer 上部エリアの変更なし
- スタイル以外のロジック変更なし
- 新規コンポーネント追加なし
