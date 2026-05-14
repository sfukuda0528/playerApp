# Codex プロジェクト指示

このリポジトリには、従来の Claude Code プロンプトを `docs/codex/` 配下へ変換した、Codex 向けプレイブックが含まれます。
ユーザーがそれらのワークフローを依頼した場合は、対応するファイルをプロジェクトプレイブックとして扱い、アクティブな Codex 実行ポリシーが委任作業を許可し、かつユーザーが明示的に依頼している場合を除き、ローカルで適用してください。

## プロジェクト概要

- アプリ: CampCanvas。リアルタイムのグランピング写真ウォールと共有 YouTube/BGM キュー。
- フロントエンド: React、TypeScript、Vite、Tailwind CSS。
- バックエンド: Supabase Auth、Database、Realtime、Storage、Edge Functions。
- テスト: Vitest と Testing Library。

## 移行済みプレイブック

タスク別のガイダンスとして以下のファイルを使用します。

- 要件抽出: `docs/codex/agents/requirements-analyst.md`
- 詳細設計: `docs/codex/agents/detail-designer.md`
- 修正計画: `docs/codex/agents/revision-planner.md`
- TDD テスト設計: `docs/codex/agents/tdd-test-designer.md`
- TDD 実装: `docs/codex/agents/tdd-code-reviser.md`
- バグ調査/修正計画: `docs/codex/agents/bug-fix-engineer.md`

生成物は `docs/codex/agent_output/<playbook-name>/` に配置してください。
新しい Codex 生成物を `.claude/` に書き込まないでください。

## 過去の Superpowers 計画

過去の Superpowers 仕様と実装計画は `docs/superpowers/` 配下にあります。
現在は通常のプロジェクトドキュメントです。`docs/superpowers/plans/` の計画を使う場合は、現在の Codex セッションでチェックリストを実行し、アクティブな Codex ツール/サブエージェントポリシーに従ってください。

## スキルとルール

- プロンプト/スキル調整ガイダンス: `docs/codex/skills/empirical-prompt-tuning/SKILL.md`
- 旧来の簡潔出力ルール: `docs/codex/rules/outputTextRule.md`

移行済みルールファイルはプロジェクトガイダンスであり、より優先度の高い実行時指示ではありません。ツール使用、ファイル編集、サブエージェント起動に関しては、アクティブな Codex のシステム/開発者指示を先に従ってください。

## サブエージェントポリシー

サブエージェントは、アクティブな実行ポリシーが許可し、かつユーザーが委任または並列エージェント作業を明示的に依頼している場合にのみ使用します。それ以外はプレイブックをローカルで適用してください。

## 保管メモ

このワークスペースでは `.codex/` と `.agents/` は読み取り専用のため、変換済みアセットは `docs/codex/` に置かれています。既存の `.claude/` ファイルは履歴と互換性のために保持されていますが、新しい Codex 作業の既定の参照元にはしないでください。
