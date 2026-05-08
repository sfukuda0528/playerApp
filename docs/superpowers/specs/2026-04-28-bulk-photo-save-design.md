# Bulk Photo Save — Design Spec

**Date**: 2026-04-28

## Overview

スライドショーの写真をスマホなどの端末に一括保存する機能。セッションの全参加者が使用可能。Web Share API を使いネイティブ共有シートを呼び出す。非対応デバイスではボタンを非表示にする。

---

## Requirements

| 項目 | 内容 |
|------|------|
| 対象写真 | セッション全員分の全写真 |
| 利用者 | 全参加者（ホスト・ゲスト問わず） |
| ダウンロード方式 | Web Share API（非対応デバイスはボタン非表示） |
| ボタン位置 | 写真タブ内、「写真を追加」ボタンの下 |

---

## UI

```
[ 📷 写真を追加        ]   ← 既存
[ 💾 全写真を保存(N枚) ]   ← 追加（canShare=true 時のみ表示）
[ 自分の写真グリッド   ]   ← 既存
```

- 写真が0枚のとき: ボタン非表示
- 保存処理中: ボタン無効化 + ラベルを「⏳ 読み込み中...」に変更
- `navigator.canShare` が false（PCのChrome等）: ボタン非表示

---

## Architecture

### 変更ファイル

**`src/components/PhotoUpload.tsx`** のみ。

### データフロー

1. `photos` prop（全員分）が渡り済み → 追加のAPI呼び出し不要
2. `supabase.storage.from('photos').getPublicUrl(path)` で各写真の公開URLを生成
3. ボタンクリック時:
   - 各URLを `fetch` して `Blob` に変換
   - `new File([blob], filename, { type: blob.type })` で `File` オブジェクト生成
   - `navigator.share({ files, title: 'CampCanvas 写真' })` を呼び出す
4. 共有シートが表示され、ユーザーが「写真に保存」を選択するとカメラロールに追加される

### State 追加

```ts
const [canShare, setCanShare] = useState(false)
const [sharing, setSharing] = useState(false)
```

`canShare` は `useEffect` 内で `navigator.canShare?.({ files: [new File([], 'test.jpg')] }) ?? false` で初期化。

### エラーハンドリング

- fetch 失敗時: `console.error` のみ（silent fail）
- `navigator.share` キャンセル時: `AbortError` を無視

---

## Constraints

- Supabase Storage のパブリックバケットは CORS 許可済みのため `fetch` でBlobに変換可能
- Web Share API + files はHTTPS または localhost 必須（本番環境では問題なし）
- iOS Safari 15+、Android Chrome 75+ で動作確認済み（ブラウザ標準API）
- 外部ライブラリ追加なし

---

## Out of Scope

- PC向けZIPダウンロードフォールバック
- 個別写真の保存
- 保存進捗のパーセント表示
