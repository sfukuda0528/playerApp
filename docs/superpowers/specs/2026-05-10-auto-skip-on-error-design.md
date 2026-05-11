# 設計書: 再生エラー時の自動スキップ機能

## 概要

YouTube Premium限定動画・地域制限動画など再生できない動画が自動再生で当たった場合、即座に次の曲へスキップし、ユーザーにトースト通知を表示する。

## 要件

- 再生エラー発生時、現在の曲をキューから削除して即座に次の曲を再生する
- 「再生できないためスキップしました」というトーストを3秒間表示する
- スキップと通知表示は独立して動作する（通知を待たずに次の曲が始まる）

## アーキテクチャ

### YouTubePlayer.tsx

`onError?: () => void` prop を追加。YouTube IFrame API のエラーイベント発火時に呼び出す。

**変更内容:**
- `Props` に `onError?: () => void` を追加
- `onError` イベントハンドラで `onError?.()` を呼び出す
- 既存のローカル `playerError` state と「再生できません」表示を削除（通知責務をMusicPanelへ移管）

### MusicPanel.tsx

エラーハンドラとローカルトーストを実装する。

**変更内容:**

1. `skipToast: boolean` state を追加
2. `handleError` 関数を実装:
   ```ts
   const handleError = () => {
     if (!currentLink) return
     setSkipToast(true)
     void deleteLink(currentLink.id)
     setTimeout(() => setSkipToast(false), 3000)
   }
   ```
3. `YouTubePlayer` に `onError={handleError}` を渡す
4. プレイヤーエリア直下にトーストを表示:
   ```tsx
   {skipToast && (
     <p role="status" className="...">再生できないためスキップしました</p>
   )}
   ```

## 動作フロー

```
YouTube API onError 発火
  → YouTubePlayer が onError prop を呼ぶ
  → MusicPanel.handleError 実行
      ├─ setSkipToast(true)        → トースト表示開始
      ├─ deleteLink(currentLink.id) → 曲削除 → 次の曲が即座に再生開始
      └─ setTimeout 3000ms         → 3秒後 skipToast = false
```

## スコープ外

- エラーコード別の処理分岐（すべてのエラーを同一に扱う）
- スキップ回数の記録・統計
- 連続エラー時の停止処理
