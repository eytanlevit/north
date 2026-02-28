# North — Project Management for Code

> "A North Star for your projects."

North is a filesystem-based project management tool designed for developers who work with AI coding agents. It combines a CLI for programmatic access with a terminal UI (TUI) for visual project oversight — all backed by plain markdown files that live in your git repo.

## Why North Exists

Modern software development increasingly involves AI coding agents (Claude Code, etc.) working alongside humans. These agents need structured project context — what's being built, what tasks exist, what's blocked, what's done. Existing tools (Linear, Jira, GitHub Issues) are web-first, API-heavy, and disconnected from the codebase.

North solves this by making project management **filesystem-native**:
- Issues are markdown files with YAML frontmatter
- Project descriptions and docs live alongside your code
- Everything is git-trackable, diffable, and version-controlled
- Agents interact via simple CLI commands
- Humans get a rich TUI for visual oversight

## Core Concepts

### Project
A North project lives in a `.north/` directory at the root of your codebase. It contains a project description, configuration, issues, and attached documents.

### Issues
Each issue is a single markdown file (e.g., `NOR-1.md`) with YAML frontmatter for metadata and markdown body for description, acceptance criteria, and notes.

### Documents
A `docs/` folder holds any attached files — PRDs, specs, API schemas, images, design docs. These provide context for both humans and agents.

### Chat (TUI)
The TUI embeds a Claude Code subprocess in the left pane, giving you an AI assistant with full project context. The right pane shows a kanban-style issue board.

## Architecture

### Language & Framework
- **Language:** Go
- **TUI Framework:** Bubble Tea (charmbracelet/bubbletea)
- **Distribution:** Standalone binary via `go install` or Homebrew

### Filesystem Layout

```
.north/
  project.md          # Project description, vision, goals
  config.yaml         # Project settings (prefix, statuses, labels, etc.)
  issues/
    NOR-1.md          # One file per issue
    NOR-2.md
    NOR-3.md
  docs/
    prd.md            # Attached documents (any file type)
    api-spec.yaml
    architecture.png
```

### Issue File Format

```markdown
---
id: NOR-1
title: Implement user authentication
status: in-progress
priority: high
labels: [auth, backend]
parent: NOR-0
blocked_by: []
created: 2026-02-28
updated: 2026-02-28
---

## Description

Implement JWT-based authentication for the API...

## Acceptance Criteria

- [ ] Login endpoint returns JWT token
- [ ] Token validation middleware
- [ ] Refresh token flow

## Comments

### 2026-02-28 — claude-code
Started work on this. Created auth middleware in `pkg/auth/`.

### 2026-02-28 — eytan
Looks good, but use RS256 instead of HS256.
```

### Issue Statuses (Linear-style)
- **Backlog** — Not yet planned
- **Todo** — Planned, ready to be picked up
- **In Progress** — Actively being worked on
- **Done** — Completed
- **Canceled** — Won't do

Issues stay in `issues/` regardless of status (no archiving/moving).

### Issue Metadata
| Field        | Type       | Description                          |
|-------------|------------|--------------------------------------|
| `id`        | string     | Project-prefixed ID (e.g., `NOR-1`)  |
| `title`     | string     | Short descriptive title              |
| `status`    | enum       | One of the 5 statuses above          |
| `priority`  | enum       | `urgent`, `high`, `medium`, `low`    |
| `labels`    | string[]   | Freeform tags                        |
| `parent`    | string?    | Parent issue ID (for sub-tasks)      |
| `blocked_by`| string[]   | IDs of blocking issues               |
| `created`   | date       | Creation date                        |
| `updated`   | date       | Last modified date                   |

### Config File (`config.yaml`)

```yaml
prefix: NOR
name: "North"
description: "Project management for code"
next_id: 4

statuses:
  - backlog
  - todo
  - in-progress
  - done
  - canceled

priorities:
  - urgent
  - high
  - medium
  - low
```

## CLI Design

The CLI is the primary interface for coding agents. All commands are subcommands of `north`.

### Project Commands
```bash
north init                          # Initialize .north/ in current directory
north project show                  # Show project description
north project edit                  # Open project.md in $EDITOR
```

### Issue Commands
```bash
north issue list                    # List all issues (filterable)
north issue list --status todo      # Filter by status
north issue list --label backend    # Filter by label
north issue create "Title"          # Create a new issue (opens $EDITOR or inline)
north issue show NOR-1              # Show full issue details
north issue update NOR-1 --status done    # Update issue fields
north issue comment NOR-1 "message"       # Add a comment
north issue edit NOR-1              # Open issue in $EDITOR
```

### Context Command (Key for Agents)
```bash
north context NOR-1                 # Output everything an agent needs:
                                    #   - Project description
                                    #   - Issue details + all comments
                                    #   - Related/blocking issues
                                    #   - Relevant docs (if linked)
```

This single command gives a coding agent full context to start working on an issue.

### Document Commands
```bash
north doc list                      # List attached documents
north doc add path/to/file.md       # Copy a file into .north/docs/
north doc show prd.md               # Display a document
```

## TUI Design

### Layout
```
┌──────────────────┬────────────────────────────┐
│  Claude Code     │  Issue Board               │
│  (subprocess)    │                             │
│                  │  ┌──────┐ ┌──────┐ ┌──────┐│
│  > help me plan  │  │ Todo │ │ Prog │ │ Done ││
│    the auth      │  │      │ │      │ │      ││
│    system        │  │NOR-1 │ │NOR-3 │ │NOR-5 ││
│                  │  │NOR-2 │ │NOR-4 │ │NOR-6 ││
│  Claude:         │  │      │ │      │ │      ││
│  Here's my plan  │  └──────┘ └──────┘ └──────┘│
│  for auth...     │                             │
│                  │  ── Backlog ──────────────  │
│  > _             │  NOR-7  NOR-8  NOR-9       │
└──────────────────┴────────────────────────────┘
```

- **Left pane:** Embedded Claude Code session (subprocess). Has full project context injected. Can read/write issues via North CLI.
- **Right pane:** Kanban board showing issues grouped by status. Navigable with keyboard. Select an issue to see its detail.
- **Keyboard-driven:** vim-style navigation, shortcuts for common actions.

### Key Interactions
- Navigate issues with `j/k` or arrow keys
- Press `Enter` to view issue detail
- Press `c` to create a new issue
- Press `s` to change status
- Press `Tab` to switch focus between chat and board
- Press `?` for help

## Claude Code Integration

### Skill: `north`
A Claude Code skill (installed at `~/.claude/skills/north.md` or bundled with `north init`) that teaches agents how to interact with North:

- How to read project context (`north context NOR-1`)
- How to create/update issues (`north issue create/update`)
- How to add comments when work is done
- How to check what's blocked and what to work on next
- Conventions for commit messages referencing issues

### Future: Hooks (v2)
- **On session start:** Auto-inject active issue context into Claude Code
- **On compaction:** Re-inject critical project context so it survives context compression
- **On issue status change:** Trigger notifications or dependent workflows
- **Staleness detection:** Flag issues that haven't been updated in N days

## Milestones

### M1: Core CLI
- `north init` — scaffold `.north/` directory
- `north issue create/list/show/update/comment`
- `north project show/edit`
- `north context` — dump full context for an issue
- `north doc list/add/show`
- Markdown + frontmatter file format
- Config file for project settings

### M2: TUI
- Bubble Tea-based terminal UI
- Kanban board view (right pane)
- Issue detail view
- Keyboard navigation
- Create/edit issues from TUI

### M3: Chat Integration
- Embed Claude Code subprocess in left pane
- Inject project context into subprocess
- Chat can read/write issues via North CLI

### M4: Skills & Hooks
- Claude Code skill for North workflows
- Session start hooks for context injection
- Compaction hooks for context preservation
- Staleness detection and notifications

### M5: Polish & Distribution
- Homebrew formula
- `go install` support
- Comprehensive help/docs
- Shell completions (zsh, bash, fish)

## Design Principles

1. **Filesystem-first.** Everything is a file. No databases, no servers. Git is the sync layer.
2. **Agent-friendly.** CLI outputs are parseable, predictable, and context-rich. Agents should be first-class users.
3. **Human-readable.** Files are markdown you can read and edit by hand. No binary formats.
4. **Minimal ceremony.** Create an issue in one command. No required fields beyond title.
5. **Progressive complexity.** Works without AI. Works without TUI. Each layer adds value but isn't required.
6. **Single-user first.** Optimize for one developer + their agents. Multi-user via git later.

## Technical Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Language | Go | Single binary, fast startup, Bubble Tea ecosystem |
| Storage | Markdown + YAML frontmatter | Human-readable, git-diffable, agent-friendly |
| IDs | `PREFIX-N` (e.g., `NOR-1`) | Linear-style, human-readable, sequential |
| TUI | Bubble Tea | Best Go TUI framework, active community |
| Chat | Claude Code subprocess | Full Claude Code capabilities, no custom AI needed |
| Distribution | Standalone binary | `go install` + Homebrew, zero dependencies |
| Config | YAML | Simple, human-editable, well-supported in Go |
