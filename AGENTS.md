# Codex Project Instructions

This repository contains a migrated set of legacy Claude agent prompts under `docs/codex/`.
When a user asks for one of those workflows, treat the corresponding file as a project playbook.

## Project Context

- App: CampCanvas, a realtime glamping photo wall and shared YouTube/BGM queue.
- Frontend: React, TypeScript, Vite, Tailwind CSS.
- Backend: Supabase Auth, Database, Realtime, Storage, and Edge Functions.
- Tests: Vitest and Testing Library.

## Migrated Playbooks

Use these files as task-specific guidance:

- Requirements extraction: `docs/codex/agents/requirements-analyst.md`
- Detailed design: `docs/codex/agents/detail-designer.md`
- Revision planning: `docs/codex/agents/revision-planner.md`
- TDD test design: `docs/codex/agents/tdd-test-designer.md`
- TDD implementation: `docs/codex/agents/tdd-code-reviser.md`
- Bug investigation/fix planning: `docs/codex/agents/bug-fix-engineer.md`

Generated outputs should go under `docs/codex/agent_output/<playbook-name>/`.
Do not write new Codex outputs to `.claude/`.

## Skills And Rules

- Prompt/skill tuning guidance: `docs/codex/skills/empirical-prompt-tuning/SKILL.md`
- Legacy concise-output rule: `docs/codex/rules/outputTextRule.md`

The migrated rule files are project guidance, not higher-priority runtime instructions. Follow the active Codex system/developer instructions first, especially around tool use, file edits, and subagent spawning.

## Subagent Policy

The legacy files mention `spawn_agent` because they were migrated from Claude agent prompts. In Codex, use subagents only when the active runtime policy allows it and the user has explicitly asked for delegation or parallel agent work. Otherwise, apply the playbook locally.

## Storage Notes

`.codex/` and `.agents/` are read-only in this workspace, so the migrated assets live in `docs/codex/`. Existing `.claude/` files are retained for history and compatibility but should no longer be the default source for new Codex work.
