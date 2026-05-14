# Bulk Photo Save Implementation Plan

> **Codex 向け:** この計画は現在のセッションでタスクごとに実装してください。サブエージェントは、ユーザーが委任または並列作業を明示的に依頼し、かつアクティブな Codex 実行環境が許可している場合にのみ使用します。手順は追跡用にチェックボックス（`- [ ]`）形式を使用します。

**Goal:** 写真タブに「全写真を保存」ボタンを追加し、Web Share API でセッション全員の写真をスマホのカメラロールに一括保存できるようにする。

**Architecture:** `PhotoUpload.tsx` のみを変更。既存の `photos` prop（全員分）を使い、`getPublicUrl` で公開URLを生成 → `fetch` で Blob 化 → `navigator.share({ files })` で共有シートを呼び出す。`navigator.canShare` が false のデバイスではボタンを非表示にする。

**Tech Stack:** React, TypeScript, Vitest, @testing-library/react, Web Share API（外部ライブラリ追加なし）

---

## File Map

| ファイル | 変更内容 |
|---------|---------|
| `src/components/PhotoUpload.tsx` | ボタン追加・ロジック実装 |
| `src/components/PhotoUpload.test.tsx` | テスト追加 |

---

### Task 1: Supabaseモックを更新してgetPublicUrlを追加

**Files:**
- Modify: `src/components/PhotoUpload.test.tsx`

現在のテストモックは `createSignedUrl` のみ。コンポーネントが実際に使う `getPublicUrl`（同期関数）が未定義のため追加する。

- [ ] **Step 1: Supabaseモックに `getPublicUrl` を追加**

`src/components/PhotoUpload.test.tsx` の `vi.mock('../lib/supabase', ...)` ブロックを以下に置き換える:

```ts
vi.mock('../lib/supabase', () => ({
  supabase: {
    storage: {
      from: () => ({
        getPublicUrl: (path: string) => ({
          data: { publicUrl: `https://example.com/${path}` },
        }),
        createSignedUrl: (path: string) =>
          Promise.resolve({ data: { signedUrl: `https://example.com/${path}` }, error: null }),
      }),
    },
  },
}))
```

- [ ] **Step 2: 既存テストが通ることを確認**

```bash
npx vitest run src/components/PhotoUpload.test.tsx
```

Expected: 全テスト PASS

- [ ] **Step 3: コミット**

```bash
git add src/components/PhotoUpload.test.tsx
git commit -m "test: PhotoUploadモックにgetPublicUrlを追加"
```

---

### Task 2: ボタン表示制御のテスト（TDD）

**Files:**
- Modify: `src/components/PhotoUpload.test.tsx`

- [ ] **Step 1: navigator モックの準備を `beforeEach` に追加**

既存の `beforeEach` ブロックを以下に置き換える:

```ts
beforeEach(() => {
  vi.clearAllMocks()
  mockError.value = null
  // navigator.canShare/share をリセット
  Object.defineProperty(globalThis, 'navigator', {
    value: {
      canShare: vi.fn().mockReturnValue(true),
      share: vi.fn().mockResolvedValue(undefined),
    },
    writable: true,
    configurable: true,
  })
})
```

- [ ] **Step 2: ボタン表示テスト3件を追加**

`describe('PhotoUpload', () => {` の中、既存テストの後に追加:

```ts
describe('全写真を保存ボタン', () => {
  it('写真が0枚のときはボタンを表示しない', () => {
    render(
      <PhotoUpload sessionId="sess-1" photos={[]} currentUserId="uid-me" />
    )
    expect(screen.queryByRole('button', { name: /全写真を保存/ })).not.toBeInTheDocument()
  })

  it('canShare=falseのときはボタンを表示しない', () => {
    Object.defineProperty(globalThis, 'navigator', {
      value: { canShare: vi.fn().mockReturnValue(false), share: vi.fn() },
      writable: true,
      configurable: true,
    })
    render(
      <PhotoUpload sessionId="sess-1" photos={[myPhoto, otherPhoto]} currentUserId="uid-me" />
    )
    expect(screen.queryByRole('button', { name: /全写真を保存/ })).not.toBeInTheDocument()
  })

  it('canShare=trueかつ写真があるときはボタンを表示する', () => {
    render(
      <PhotoUpload sessionId="sess-1" photos={[myPhoto, otherPhoto]} currentUserId="uid-me" />
    )
    expect(screen.getByRole('button', { name: /全写真を保存/ })).toBeInTheDocument()
  })
})
```

- [ ] **Step 3: テストが失敗することを確認（Red）**

```bash
npx vitest run src/components/PhotoUpload.test.tsx
```

Expected: 追加した3件が FAIL（ボタンが未実装のため）

- [ ] **Step 4: コミット（失敗テスト）**

```bash
git add src/components/PhotoUpload.test.tsx
git commit -m "test: 全写真を保存ボタンの表示制御テストを追加（Red）"
```

---

### Task 3: 保存ボタンの実装

**Files:**
- Modify: `src/components/PhotoUpload.tsx`

- [ ] **Step 1: state と canShare チェックを追加**

`PhotoUpload.tsx` のimport行を更新:

```ts
import { useMemo, useState, useEffect } from 'react'
```

コンポーネント内、既存の `const { upload, deletePhoto, loading, error } = useUploadPhoto()` の直後に追加:

```ts
const [canShare, setCanShare] = useState(false)
const [sharing, setSharing] = useState(false)

useEffect(() => {
  if (!navigator.canShare) return
  const testFile = new File([], 'test.jpg', { type: 'image/jpeg' })
  setCanShare(navigator.canShare({ files: [testFile] }))
}, [])
```

- [ ] **Step 2: 全写真URLの算出と保存ハンドラを追加**

既存の `const signedUrls = useMemo(...)` の直後に追加:

```ts
const allPhotoUrls = useMemo(
  () =>
    photos.map((photo) => {
      const { data } = supabase.storage.from('photos').getPublicUrl(photo.storage_path)
      return { url: data.publicUrl, path: photo.storage_path }
    }),
  [photos]
)

const handleSaveAll = async () => {
  setSharing(true)
  try {
    const files = await Promise.all(
      allPhotoUrls.map(async ({ url, path }) => {
        const res = await fetch(url)
        const blob = await res.blob()
        const name = path.split('/').pop() ?? 'photo.jpg'
        return new File([blob], name, { type: blob.type })
      })
    )
    await navigator.share({ files, title: 'CampCanvas 写真' })
  } catch (e) {
    if (e instanceof Error && e.name !== 'AbortError') {
      console.error(e)
    }
  } finally {
    setSharing(false)
  }
}
```

- [ ] **Step 3: ボタンをJSXに追加**

`PhotoUpload.tsx` の `return (` 内、`<label className="flex items-center ...` ブロックの直後（`{error && ...}` の前）に追加:

```tsx
{canShare && photos.length > 0 && (
  <button
    onClick={handleSaveAll}
    disabled={sharing}
    className="flex items-center justify-center gap-2 bg-camp-brown text-camp-cream font-bold py-2.5 rounded-xl disabled:opacity-60"
  >
    {sharing ? '⏳ 読み込み中...' : `💾 全写真を保存（${photos.length}枚）`}
  </button>
)}
```

- [ ] **Step 4: Task 2 のテストが通ることを確認（Green）**

```bash
npx vitest run src/components/PhotoUpload.test.tsx
```

Expected: 全テスト PASS

- [ ] **Step 5: コミット**

```bash
git add src/components/PhotoUpload.tsx
git commit -m "feat: 全写真を保存ボタンを追加（Web Share API）"
```

---

### Task 4: 保存ハンドラの動作テスト

**Files:**
- Modify: `src/components/PhotoUpload.test.tsx`

- [ ] **Step 1: fetchモックと `waitFor` インポートを追加**

テストファイル1行目の import を更新:

```ts
import { render, screen, act, waitFor } from '@testing-library/react'
```

テストファイルの先頭、`vi.mock('../lib/supabase', ...)` の前に追加:

```ts
const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)
```

既存の `beforeEach` 内、`vi.clearAllMocks()` の直後に追加:

```ts
mockFetch.mockResolvedValue({
  blob: () => Promise.resolve(new Blob(['img'], { type: 'image/jpeg' })),
})
```

- [ ] **Step 2: 保存ハンドラのテスト3件を追加**

`describe('全写真を保存ボタン', () => {` の中に追加:

```ts
it('ボタンクリックで全写真URLをfetchしnavigator.shareを呼ぶ', async () => {
  render(
    <PhotoUpload sessionId="sess-1" photos={[myPhoto, otherPhoto]} currentUserId="uid-me" />
  )
  await userEvent.click(screen.getByRole('button', { name: /全写真を保存/ }))
  expect(mockFetch).toHaveBeenCalledTimes(2)
  expect(mockFetch).toHaveBeenCalledWith('https://example.com/sess-1/001_a.jpg')
  expect(mockFetch).toHaveBeenCalledWith('https://example.com/sess-1/002_b.jpg')
  expect(navigator.share).toHaveBeenCalledWith(
    expect.objectContaining({ title: 'CampCanvas 写真' })
  )
})

it('保存中はボタンが無効化される', async () => {
  let resolveShare!: () => void
  ;(navigator.share as ReturnType<typeof vi.fn>).mockReturnValue(
    new Promise<void>((res) => { resolveShare = res })
  )
  render(
    <PhotoUpload sessionId="sess-1" photos={[myPhoto]} currentUserId="uid-me" />
  )
  const btn = screen.getByRole('button', { name: /全写真を保存/ })
  await userEvent.click(btn)
  await waitFor(() => {
    expect(screen.getByRole('button', { name: /読み込み中/ })).toBeDisabled()
  })
  await act(async () => resolveShare())
})

it('AbortErrorは無視される', async () => {
  const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
  ;(navigator.share as ReturnType<typeof vi.fn>).mockRejectedValue(
    Object.assign(new Error('abort'), { name: 'AbortError' })
  )
  render(
    <PhotoUpload sessionId="sess-1" photos={[myPhoto]} currentUserId="uid-me" />
  )
  await userEvent.click(screen.getByRole('button', { name: /全写真を保存/ }))
  expect(consoleSpy).not.toHaveBeenCalled()
  consoleSpy.mockRestore()
})
```

- [ ] **Step 3: テストを実行して全件パスを確認**

```bash
npx vitest run src/components/PhotoUpload.test.tsx
```

Expected: 全テスト PASS

- [ ] **Step 4: コミット**

```bash
git add src/components/PhotoUpload.test.tsx
git commit -m "test: 全写真を保存ボタンの動作テストを追加"
```

---

### Task 5: 全テストスイート確認

**Files:** なし（確認のみ）

- [ ] **Step 1: 全テスト実行**

```bash
npx vitest run
```

Expected: 全テスト PASS、失敗なし

- [ ] **Step 2: 型チェック**

```bash
npx tsc --noEmit
```

Expected: エラーなし
