# セッションメンバー名表示 実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** InviteScreen（スタート前）と MainPage メンバータブ（スタート後）にメンバー名一覧を表示し、ホストに👑マークを付ける

**Architecture:** 既存の `useParticipants` フックが返す `participants` 配列と `session.host_auth_id` を比較してホストを判定する。新規フック・コンポーネント不要。ホストを先頭にソートし、縦リストで表示する。

**Tech Stack:** React 19, TypeScript, Tailwind CSS v4, Vitest + Testing Library

---

## 変更ファイル一覧

| ファイル | 変更内容 |
|---|---|
| `src/components/InviteScreen.tsx` | 人数カウント下にメンバーリスト追加 |
| `src/components/InviteScreen.test.tsx` | モック更新（auth_id・host_auth_id追加）＋新テスト追加 |
| `src/components/MainPage.tsx` | メンバータブの人数カウント下にリスト追加 |
| `src/components/MainPage.test.tsx` | モック更新（uid-alice→uid-host）＋既存テスト修正＋新テスト追加 |

---

## Task 1: InviteScreen — 失敗テストを追加

**Files:**
- Modify: `src/components/InviteScreen.test.tsx`

- [ ] **Step 1: モックと fakeSession を更新**

`InviteScreen.test.tsx` の `useParticipants` モックと `fakeSession` を以下に変更する：

```ts
// useParticipants モック（2名に増やし auth_id を追加）
vi.mock('../hooks/useParticipants', () => ({
  useParticipants: () => ({
    participants: [
      { id: 'p-1', auth_id: 'uid-alice', name: 'Alice' },
      { id: 'p-2', auth_id: 'uid-bob', name: 'Bob' },
    ],
  }),
}))

// fakeSession に host_auth_id を追加
const fakeSession = {
  id: 'sess-1', code: '472819', host_name: 'Alice', host_auth_id: 'uid-alice',
  status: 'active', last_active_at: '', inactivity_timeout_min: 360, created_at: '',
}
```

- [ ] **Step 2: 新テストを追加**

`describe('InviteScreen', ...)` ブロック内の末尾に追加：

```ts
it('メンバー名一覧を表示する', async () => {
  renderWithRoute()
  expect(await screen.findByText('👑 Alice')).toBeInTheDocument()
  expect(await screen.findByText('Bob')).toBeInTheDocument()
})

it('ホストに👑が付き、非ホストには付かない', async () => {
  renderWithRoute()
  expect(await screen.findByText('👑 Alice')).toBeInTheDocument()
  expect(screen.queryByText('👑 Bob')).not.toBeInTheDocument()
})

it('ホストが先頭に表示される', async () => {
  renderWithRoute()
  await screen.findByText('👑 Alice')
  const items = screen.getAllByRole('listitem')
  expect(items[0]).toHaveTextContent('👑 Alice')
  expect(items[1]).toHaveTextContent('Bob')
})
```

- [ ] **Step 3: テストが失敗することを確認**

```bash
npx vitest run src/components/InviteScreen.test.tsx
```

期待: 新規3テストが FAIL（`👑 Alice` 未実装のため）、既存4テストは PASS

---

## Task 2: InviteScreen — 実装

**Files:**
- Modify: `src/components/InviteScreen.tsx`

- [ ] **Step 1: メンバーリストを追加**

`InviteScreen.tsx` の `<p className="text-camp-amber...">` の直後に追加する：

変更前（該当箇所のみ抜粋）：
```tsx
<p className="text-camp-amber text-sm font-medium">
  {participants.length} / {MAX_PARTICIPANTS} 人参加中
</p>
```

変更後：
```tsx
<p className="text-camp-amber text-sm font-medium">
  {participants.length} / {MAX_PARTICIPANTS} 人参加中
</p>
<ul className="w-full space-y-1">
  {[...participants]
    .sort((a, b) =>
      a.auth_id === session?.host_auth_id ? -1 :
      b.auth_id === session?.host_auth_id ? 1 : 0
    )
    .map((p) => (
      <li key={p.id} className="text-camp-brown text-sm text-center">
        {p.auth_id === session?.host_auth_id ? '👑 ' : ''}{p.name}
      </li>
    ))}
</ul>
```

- [ ] **Step 2: テストが通ることを確認**

```bash
npx vitest run src/components/InviteScreen.test.tsx
```

期待: 全7テスト PASS

- [ ] **Step 3: コミット**

```bash
git add src/components/InviteScreen.tsx src/components/InviteScreen.test.tsx
git commit -m "feat: InviteScreen にメンバー名リストを追加（ホスト👑）"
```

---

## Task 3: MainPage — 失敗テストを追加

**Files:**
- Modify: `src/components/MainPage.test.tsx`

- [ ] **Step 1: participants モックの auth_id を更新**

`MainPage.test.tsx` の `useParticipants` モックを変更する（`uid-alice` → `uid-host` に変更して fakeSession.host_auth_id と一致させる）：

```ts
vi.mock('../hooks/useParticipants', () => ({
  useParticipants: () => ({
    participants: [
      { id: 'p-1', auth_id: 'uid-host', name: 'Alice' },
      { id: 'p-2', auth_id: 'uid-bob', name: 'Bob' },
    ],
  }),
}))
```

- [ ] **Step 2: 既存トーストテストの auth_id を修正**

`describe('MainPage - トースト', ...)` 内の写真追加テストを更新：

変更前:
```ts
const photo: Photo = {
  id: 'ph-new', session_id: 'sess-1', uploader_auth_id: 'uid-alice',
  storage_path: 'x.jpg', created_at: '',
}
```

変更後:
```ts
const photo: Photo = {
  id: 'ph-new', session_id: 'sess-1', uploader_auth_id: 'uid-host',
  storage_path: 'x.jpg', created_at: '',
}
```

（`expect` の `'📷 Aliceさんが写真を追加しました'` はそのまま — Alice の名前は変わらないため）

- [ ] **Step 3: 新テストを追加**

`describe('MainPage - 参加者', ...)` ブロックの末尾に追加：

```ts
it('メンバータブでホストに👑が付く', async () => {
  renderAsParticipant()
  await waitFor(() => screen.getByRole('tab', { name: /メンバー/ }))
  await userEvent.click(screen.getByRole('tab', { name: /メンバー/ }))
  expect(await screen.findByText('👑 Alice')).toBeInTheDocument()
})

it('メンバータブで非ホストに👑が付かない', async () => {
  renderAsParticipant()
  await waitFor(() => screen.getByRole('tab', { name: /メンバー/ }))
  await userEvent.click(screen.getByRole('tab', { name: /メンバー/ }))
  await screen.findByText('Bob')
  expect(screen.queryByText('👑 Bob')).not.toBeInTheDocument()
})
```

- [ ] **Step 4: テストが失敗することを確認**

```bash
npx vitest run src/components/MainPage.test.tsx
```

期待: 新規2テストが FAIL（メンバーリスト未実装）、既存テストはすべて PASS

---

## Task 4: MainPage — 実装

**Files:**
- Modify: `src/components/MainPage.tsx`

- [ ] **Step 1: メンバータブにリストを追加**

`MainPage.tsx` の `<TabsContent value="member" ...>` 内の `<p>` 直後に追加する：

変更前（該当箇所のみ抜粋）：
```tsx
<TabsContent value="member" className="flex-1 overflow-y-auto p-4 space-y-4 mt-0">
  <p className="text-center text-camp-amber text-sm font-medium">
    {participants.length} / {MAX_PARTICIPANTS} 人参加中
  </p>
  {isHost && (
```

変更後：
```tsx
<TabsContent value="member" className="flex-1 overflow-y-auto p-4 space-y-4 mt-0">
  <p className="text-center text-camp-amber text-sm font-medium">
    {participants.length} / {MAX_PARTICIPANTS} 人参加中
  </p>
  <ul className="space-y-1">
    {[...participants]
      .sort((a, b) =>
        a.auth_id === session?.host_auth_id ? -1 :
        b.auth_id === session?.host_auth_id ? 1 : 0
      )
      .map((p) => (
        <li key={p.id} className="text-camp-brown text-sm text-center">
          {p.auth_id === session?.host_auth_id ? '👑 ' : ''}{p.name}
        </li>
      ))}
  </ul>
  {isHost && (
```

- [ ] **Step 2: テストが通ることを確認**

```bash
npx vitest run src/components/MainPage.test.tsx
```

期待: 全テスト PASS

- [ ] **Step 3: 全テストを実行して回帰がないことを確認**

```bash
npx vitest run
```

期待: 全テスト PASS

- [ ] **Step 4: コミット**

```bash
git add src/components/MainPage.tsx src/components/MainPage.test.tsx
git commit -m "feat: MainPage メンバータブにメンバー名リストを追加（ホスト👑）"
```
