# Codex プレイブック出力

Codex プレイブックから生成されたドキュメントは、プレイブック名のサブディレクトリに配置します。

- `requirements-analyst/`
- `detail-designer/`
- `revision-planner/`
- `tdd-test-designer/`
- `tdd-code-reviser/`
- `bug-fix-engineer/`

プレイブックの最初の出力を書き込むときに、必要なサブディレクトリを作成します。ユーザーが Claude Code 互換性を明示的に求めた場合を除き、新しい生成物を `.claude/` に書き込まないでください。
