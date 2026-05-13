# Rich Member List Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the InviteScreen and MainPage member lists richer with summary panels, initial avatars, empty slots, and host badges.

**Architecture:** Keep participant fetching and host sorting inside the existing screens. Add local render helpers in each component to avoid a broad refactor and preserve current behavior.

**Tech Stack:** React, TypeScript, Vite, Tailwind CSS, FontAwesome, Vitest, Testing Library.

---

### Task 1: Test Rich Member Markers

**Files:**
- Modify: `src/components/InviteScreen.test.tsx`
- Modify: `src/components/MainPage.test.tsx`

- [ ] **Step 1: Add failing InviteScreen assertions**

Add tests that expect `参加中`, `空き枠 2`, and initial avatars for Alice and Bob.

- [ ] **Step 2: Add failing MainPage assertion**

Add a member-tab test that expects the richer summary label and empty slot text.

- [ ] **Step 3: Run focused tests**

Run: `npm test -- src/components/InviteScreen.test.tsx src/components/MainPage.test.tsx --run`

Expected: new tests fail because the richer labels do not exist yet.

### Task 2: Implement Rich Member List UI

**Files:**
- Modify: `src/components/InviteScreen.tsx`
- Modify: `src/components/MainPage.tsx`

- [ ] **Step 1: Add sorted participant and empty-slot helpers**

Derive sorted participants once per render and compute empty slots from `MAX_PARTICIPANTS`.

- [ ] **Step 2: Replace InviteScreen plain list**

Use a warm brown summary panel with participant count, initial avatars, empty slots, host badge, and a compact member list.

- [ ] **Step 3: Replace MainPage member tab list**

Use the same visual vocabulary in a quieter panel and keep the existing kick button behavior.

- [ ] **Step 4: Run focused tests**

Run: `npm test -- src/components/InviteScreen.test.tsx src/components/MainPage.test.tsx --run`

Expected: all focused tests pass.

### Task 3: Verify Build

**Files:**
- No additional files.

- [ ] **Step 1: Run build**

Run: `npm run build`

Expected: TypeScript and Vite build pass.
