# North — Project Management CLI

North is a filesystem-based project management tool. Issues are markdown files in `.north/issues/`.

## Quick Reference

### Read Commands (use --json for structured output)
- `north list [--status X] [--json]` — List all issues, optionally filter by status
- `north show <ID> [--json]` — Show full issue details
- `north context <ID> [--json]` — Get complete context: issue + blocking issues + linked docs
- `north stale [--days N] [--json]` — Find issues not updated in N days (default: 7)

### Write Commands
- `north create "Title" [--status X] [--priority X] [--label X]` — Create a new issue
- `north update <ID> [--status X] [--priority X] [--title X] [--label X]` — Update issue fields
- `north comment <ID> "message"` — Add a comment to an issue
- `north edit <ID>` — Open issue in $EDITOR for manual editing

### Interactive
- `north tui` — Open interactive kanban board
- `north session [ID]` — Launch agent session with chat + kanban board

### Setup
- `north init` — Initialize `.north/` in current directory
- `north skill install` — Install this skill for Claude Code
- `north completion bash|zsh|fish` — Generate shell completions

## Workflow for Agents

1. **Get context**: `north context NOR-1` before starting any issue
2. **Claim work**: `north update NOR-1 --status in-progress`
3. **Reference issues**: Include issue ID in commit messages (`NOR-1: description`)
4. **Log progress**: `north comment NOR-1 "Implemented feature X"`
5. **Complete**: `north update NOR-1 --status done`
6. **Check blockers**: `north list --json` then inspect `blocked_by` fields
7. **Find stale work**: `north stale --days 3`

## Issue File Format

Issues are YAML-frontmatter markdown files in `.north/issues/`:
- `id`, `title`, `status`, `priority`, `labels`, `blocked_by`, `parent`
- `comments` array in frontmatter (not markdown headers)
- Body is free-form markdown after the frontmatter

## Exit Codes
- 0: Success
- 1: Generic error
- 2: Validation error (bad status, priority, ID)
- 3: Not found (project or issue)
- 4: Conflict (project already exists)
