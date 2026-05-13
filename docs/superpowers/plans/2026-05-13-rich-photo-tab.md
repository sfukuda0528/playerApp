# Rich Photo Tab Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 写真タブにホスト向けアップロード時刻表示、全員向け枚数表示、自分の写真カード、複数枚アップロードを追加する。

**Architecture:** `Slideshow` は現在表示中写真の `created_at` を表示するだけに留める。`PhotoUpload` は既存のアップロード/削除/保存ロジックを維持し、表示構造と file input の複数選択処理を拡張する。

**Tech Stack:** React, TypeScript, Vite, Tailwind CSS, Vitest, Testing Library.

---

### Task 1: PhotoUpload behavior and UI tests

**Files:**
- Modify: `src/components/PhotoUpload.test.tsx`

- [ ] **Step 1: Write failing tests**

Add tests that assert:

```tsx
expect(screen.getByText('自分の写真')).toBeInTheDocument()
expect(screen.getByText('1枚')).toBeInTheDocument()
expect(screen.getByText('全体 2枚')).toBeInTheDocument()
expect(screen.getByLabelText('写真を追加')).toHaveAttribute('multiple')
```

For multiple upload:

```tsx
const files = [
  new File(['img1'], 'photo-1.jpg', { type: 'image/jpeg' }),
  new File(['img2'], 'photo-2.jpg', { type: 'image/jpeg' }),
]
await userEvent.upload(screen.getByLabelText('写真を追加'), files)
expect(mockUpload).toHaveBeenNthCalledWith(1, 'sess-1', files[0])
expect(mockUpload).toHaveBeenNthCalledWith(2, 'sess-1', files[1])
```

- [ ] **Step 2: Run tests and verify RED**

Run: `npm test -- src/components/PhotoUpload.test.tsx --run`

Expected: FAIL because the input is not multiple and the card/count labels do not exist.

### Task 2: Slideshow timestamp tests

**Files:**
- Modify: `src/components/Slideshow.test.tsx`

- [ ] **Step 1: Write failing tests**

Add tests that assert the first photo shows `19:00` for `2026-04-26T10:00:00Z` in Asia/Tokyo and changes to `19:01` after auto-advance.

- [ ] **Step 2: Run tests and verify RED**

Run: `npm test -- src/components/Slideshow.test.tsx --run`

Expected: FAIL because upload time is not rendered.

### Task 3: Implement PhotoUpload

**Files:**
- Modify: `src/components/PhotoUpload.tsx`

- [ ] **Step 1: Add multiple upload handling**

Read all files from `e.target.files`, upload them sequentially, update local progress state, and clear the input after completion.

- [ ] **Step 2: Cardize the UI**

Wrap count summaries, add button, save button, errors, and thumbnails in a single white card. Keep delete buttons and signed URL loading unchanged.

- [ ] **Step 3: Run PhotoUpload tests**

Run: `npm test -- src/components/PhotoUpload.test.tsx --run`

Expected: PASS.

### Task 4: Implement Slideshow timestamp

**Files:**
- Modify: `src/components/Slideshow.tsx`

- [ ] **Step 1: Format current photo upload time**

Use `Intl.DateTimeFormat('ja-JP', { hour: '2-digit', minute: '2-digit' })` against `photos[safeIndex].created_at`.

- [ ] **Step 2: Render timestamp**

Show `HH:mm にアップロード` beside the slide counter in normal mode and fullscreen mode.

- [ ] **Step 3: Run Slideshow tests**

Run: `npm test -- src/components/Slideshow.test.tsx --run`

Expected: PASS.

### Task 5: Integration verification

**Files:**
- Modify only if tests require it: `src/components/MainPage.test.tsx`

- [ ] **Step 1: Run affected component tests**

Run: `npm test -- src/components/PhotoUpload.test.tsx src/components/Slideshow.test.tsx src/components/MainPage.test.tsx --run`

Expected: PASS.

- [ ] **Step 2: Run full test suite if practical**

Run: `npm test -- --run`

Expected: PASS.
