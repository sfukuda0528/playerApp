# Codex Migration

This directory contains Claude-related project assets migrated for Codex use.

## Layout

- `agents/`: role playbooks converted from `.claude/agents/`
- `rules/`: reusable project rules converted from `.claude/rules/`
- `skills/`: skill-style workflows converted from `.claude/skills/`
- `agent_output/`: migrated generated outputs and future Codex-generated role outputs
- `agent_memory/`: optional per-playbook project memory indexes

## Usage

Start from the root `AGENTS.md`. For a specific workflow, read the matching playbook in `docs/codex/agents/` and write generated documents to `docs/codex/agent_output/<playbook-name>/`.

Do not write new generated artifacts to `.claude/` unless the user explicitly asks for Claude compatibility.
