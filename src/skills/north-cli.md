---
name: north-cli
description: Guide for using the north CLI and understanding the project structure. Load this skill when working with north issues, the project board, or the TUI.
---

# north — CLI & Project Guide

north is a TUI-based project management tool with an AI chat panel (left) and kanban board (right). Issues are stored as markdown files with YAML frontmatter in `.north/issues/`.

## Running

```bash
# TUI (interactive — chat + kanban)
npm run dev          # dev mode (tsx)

# CLI (headless — for scripts and agents)
npm run cli -- <command>   # dev mode
north <command>            # built binary (./dist/cli.js)
```

## CLI Commands

### Initialize a project
```bash
north init
# Creates .north/ with config.yaml, project.md, issues/
```

### Create an issue
```bash
north create "Title" [--status todo|in-progress|done] [--priority low|medium|high] [--body "text"]
# Defaults: status=todo, priority=medium
# Example:
north create "Add dark mode" --priority high --body "Support system theme detection"
```

### List issues
```bash
north list [--status STATUS] [--json]
north ls                                    # alias
# When stdout is not a TTY (piped/agent), output auto-defaults to JSON
```

### Show issue details
```bash
north show <ID> [--json]
# ID formats: NOR-001, NOR-1, or just 1 (all normalized)
```

### Update an issue
```bash
north update <ID> [--status STATUS] [--priority PRIORITY] [--title "text"] [--body "text"]
# Only specified fields are changed; others preserved
```

### Add a comment
```bash
north comment <ID> "message" [--author AUTHOR]
# Default author: "user"
```

### Help
```bash
north help
north --help
north -h
```

## Project Structure

```
.north/
├── config.yaml          # Project config (prefix, name, statuses, priorities)
├── project.md           # Project notes/description
├── issues/
│   ├── NOR-001.md       # Issue files (YAML frontmatter + markdown body)
│   ├── NOR-002.md
│   └── ...
└── logs/                # Agent session logs (JSONL)
```

## Issue File Format

Each issue is a markdown file with YAML frontmatter:

```markdown
---
format_version: 1
id: NOR-001
title: Add dark mode
status: todo
priority: high
createdAt: 2026-03-01T10:00:00.000Z
labels:
  - enhancement
  - ux
parent: NOR-000           # optional — epic parent
blocked_by:               # optional — dependency IDs
  - NOR-002
assignee: agent           # optional — who's working on it
---
**Context**: 1-2 sentence goal.

**Requirements**:
- Bullet points

**Acceptance Criteria**:
- Testable checks
```

### Issue Fields

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| id | string | yes | `{PREFIX}-NNN` format |
| title | string | yes | Imperative mood ("Add X", not "Adding X") |
| status | string | yes | One of config statuses (default: todo, in-progress, done) |
| priority | string | yes | One of config priorities (default: high, medium, low) |
| createdAt | ISO date | yes | Auto-set on creation |
| body | markdown | yes | Structured body (Context, Requirements, Acceptance Criteria) |
| labels | string[] | no | Categorization tags |
| parent | string | no | Parent issue ID (for epics) |
| blocked_by | string[] | no | IDs this issue depends on |
| assignee | string | no | Who's working on it |
| comments | Comment[] | no | `{ author, date, body }` |
| docs | string[] | no | Related doc paths |

## Config (`.north/config.yaml`)

```yaml
prefix: NOR
name: north
description: A terminal-based project management tool...
statuses:
  - todo
  - in-progress
  - done
priorities:
  - high
  - medium
  - low
```

The prefix determines issue ID format. Custom statuses and priorities are supported.

## TUI Agent Tools

When running inside the TUI (`npm run dev`), the embedded AI agent has these tools:

| Tool | Description |
|------|-------------|
| `create_issue` | Create a new issue |
| `list_issues` | List/filter issues |
| `update_issue` | Update issue fields |
| `show_issue` | Read a single issue |
| `add_comment` | Add a comment to an issue |
| `delete_issue` | Delete an issue (with confirmation) |
| `show_project` | Show project config + notes |
| `update_project` | Update project config/notes |
| `ask_questions` | Present a questionnaire overlay to the user |
| `acquire_issue` | Claim an issue for work |
| `complete_issue` | Mark an issue done with summary |
| `bash` | Sandboxed shell commands |
| `read` / `grep` / `find` | Codebase exploration |

### TUI Chat Commands

- `/new` or `/clear` — Start a fresh agent session
- `/issue <description>` — Create/update an issue via the issue skill

## Tips for Agents

1. **JSON output**: When piping CLI output to parse, use `--json` or rely on auto-JSON (non-TTY stdout)
2. **ID normalization**: You can use `1`, `NOR-1`, or `NOR-001` — all resolve to `NOR-001`
3. **Direct file access**: Issues are plain markdown files at `.north/issues/{ID}.md` — you can read/edit them directly for bulk operations
4. **Relationship validation**: `blocked_by` refs are validated — circular deps and missing IDs are caught
5. **Session logs**: Agent conversation logs are saved to `~/.pi/agent/sessions/` (JSONL format)

## Source Code Layout

```
src/
├── cli.ts               # CLI entry point
├── index.ts             # TUI entry point
├── agent.ts             # AI agent session setup
├── issues.ts            # Issue CRUD operations
├── config.ts            # Config loading
├── project-root.ts      # .north/ directory finder
├── tools/               # TUI agent tool definitions
│   ├── create-issue.ts
│   ├── list-issues.ts
│   ├── update-issue.ts
│   ├── show-issue.ts
│   ├── add-comment.ts
│   ├── delete-issue.ts
│   ├── show-project.ts
│   ├── update-project.ts
│   ├── ask-questions.ts
│   ├── acquire-issue.ts
│   ├── complete-issue.ts
│   └── bash-wrapper.ts
├── skills/              # TUI agent skills (loaded as context)
│   ├── issue.md         # /issue slash command
│   └── issue-management.md  # Issue management guide
└── components/          # TUI UI components
```

## Build & Test

```bash
npm run build            # TypeScript compilation → dist/
npm run test             # vitest
npm run dev              # Run TUI in dev mode
npm run cli -- <command> # Run CLI in dev mode
```
