# Last Session Return Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a top-page button that lets users return to the last room saved in this browser.

**Architecture:** Add `src/utils/lastSession.ts` as the single persistence boundary for local storage. Existing create, join, top, and main page components call this helper at session lifecycle points.

**Tech Stack:** React, TypeScript, React Router, Vitest, Testing Library, browser `localStorage`.

---

### Task 1: Storage Helper

**Files:**
- Create: `src/utils/lastSession.ts`
- Test: `src/utils/lastSession.test.ts`

- [ ] Write tests for saving, loading, clearing, and malformed data.
- [ ] Run `npm test -- src/utils/lastSession.test.ts` and verify the new tests fail because the module does not exist.
- [ ] Implement `saveLastSession`, `loadLastSession`, and `clearLastSession`.
- [ ] Re-run `npm test -- src/utils/lastSession.test.ts` and verify it passes.

### Task 2: Save and Restore UI

**Files:**
- Modify: `src/components/TopPage.tsx`
- Modify: `src/components/SessionCreate.tsx`
- Modify: `src/components/SessionJoin.tsx`
- Test: `src/components/TopPage.test.tsx`
- Test: `src/components/SessionCreate.test.tsx`
- Test: `src/components/SessionJoin.test.tsx`

- [ ] Write tests proving create and join save successful sessions.
- [ ] Write a top-page test proving a saved session shows a "前回の部屋に戻る" button and navigates to `/session/:id`.
- [ ] Run the targeted component tests and verify the new tests fail.
- [ ] Call `saveLastSession` after successful create and join.
- [ ] Load the saved session on the top page and render the return button.
- [ ] Re-run the targeted component tests and verify they pass.

### Task 3: Clear on End

**Files:**
- Modify: `src/components/MainPage.tsx`
- Test: `src/components/MainPage.test.tsx`

- [ ] Write tests proving ending a session clears the saved session for both manual end and realtime ended notification.
- [ ] Run `npm test -- src/components/MainPage.test.tsx` and verify the new tests fail.
- [ ] Call `clearLastSession` before navigating home after an end.
- [ ] Re-run `npm test -- src/components/MainPage.test.tsx` and verify it passes.

### Task 4: Final Verification

- [ ] Run all changed tests.
- [ ] Run the project build or full test command available in `package.json`.
