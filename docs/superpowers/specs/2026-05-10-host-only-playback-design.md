# ホスト限定再生機能 設計書

**日付**: 2026-05-10

## 概要

非ホストメンバーから音楽の再生コントロールと YouTube iframe を非表示にする。
キューへの追加（検索・URL入力）と削除は引き続き全メンバーが利用可能。

## 変更ファイル

- `src/components/MusicPanel.tsx`
- `src/components/MainPage.tsx`
- `src/components/MusicPanel.test.tsx`（テスト追加）

## アーキテクチャ

### Props 変更

`MusicPanel` に `isHost: boolean` を追加。

```ts
interface Props {
  sessionId: string
  currentUserId: string
  isHost: boolean          // 追加
  onMusicAdd?: (link: MusicLink) => void
}
```

### 条件分岐

`MusicPanel` 内の `bg-camp-dark` ブロック（YouTubePlayer + skipToast）を `isHost` でガード。

```tsx
{isHost && (
  <div className="bg-camp-dark px-4 py-4 flex flex-col gap-3">
    {/* YouTubePlayer / 空状態メッセージ / skipToast */}
  </div>
)}
```

### MainPage 変更

```tsx
<MusicPanel
  sessionId={sessionId!}
  currentUserId={currentUserId}
  isHost={isHost}           // 追加
  onMusicAdd={handleMusicAdd}
/>
```

## スコープ外

- `currentIndex` / `isPlaying` のクロスユーザー同期（非ホストのキューハイライト）
- Supabase RLS レベルの操作制限
- 再生コントロールの権限をホスト以外に委譲するモード
