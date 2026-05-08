# セッション参加メンバー名表示 設計書

## 概要

セッション開始前（InviteScreen）と開始後（MainPage メンバータブ）の両方で、参加メンバーの名前一覧を表示する。ホストには👑マークを付ける。

## 変更対象

### InviteScreen.tsx（スタート前）

- 変更箇所: 人数カウント `{participants.length} / {MAX_PARTICIPANTS} 人参加中` の直下
- 追加内容: メンバー名の縦リスト
- ホスト判定: `participant.auth_id === session?.host_auth_id`
- `session` は既に `useLocation` 経由で取得済み

### MainPage.tsx メンバータブ（スタート後）

- 変更箇所: `TabsContent value="member"` 内の人数カウントの直下
- 追加内容: 同様のメンバー名リスト
- ホスト判定: `participant.auth_id === session?.host_auth_id`
- `session` は既に `useLocation` 経由で取得済み

## 表示仕様

```
1 / 4 人参加中
👑 たろう   ← ホスト（host_auth_id と一致）
けんじ
はなこ
```

- ホストを先頭に表示
- 残りは DB から返る順（joined_at 順）
- スタイル: 既存の `text-camp-brown` / `text-camp-amber` に準拠

## ホスト判定ロジック

```ts
const isParticipantHost = (p: Participant) =>
  p.auth_id === session?.host_auth_id
```

両コンポーネントで同一パターン。新規 hook・コンポーネント不要。

## スコープ外

- 参加時刻の表示
- メンバーのアバター画像
- メンバー削除機能
