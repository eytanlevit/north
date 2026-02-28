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

### Session
`north session` launches a tmux (or Zellij) layout with two independent processes side by side:
- **Left pane:** Full Claude Code (independent process, full fidelity)
- **Right pane:** `north tui` — kanban board + issue detail

Both apps are independent processes — zero embedding code. tmux handles terminal multiplexing. The TUI watches `.north/` via fsnotify and auto-refreshes when files change.

As a fallback, the TUI also supports `tea.Exec()`: pressing `c` launches Claude Code fullscreen, and the TUI resumes when Claude exits.

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
  CLAUDE.md           # Generated template teaching agents how to use North
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
format_version: 1
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

### Issue Statuses
- **Todo** — Ready to be worked on
- **In Progress** — Actively being worked on
- **Done** — Completed

Additional statuses can be added via `config.yaml`.

Issues stay in `issues/` regardless of status (no archiving/moving).

### Issue Metadata
| Field        | Type       | Description                          |
|-------------|------------|--------------------------------------|
| `format_version` | int   | Schema version (currently `1`)       |
| `id`        | string     | Project-prefixed ID (e.g., `NOR-1`)  |
| `title`     | string     | Short descriptive title              |
| `status`    | enum       | One of the statuses above            |
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
  - todo
  - in-progress
  - done

priorities:
  - urgent
  - high
  - medium
  - low
```

## CLI Design

The CLI is the primary interface for coding agents. All commands are flat subcommands of `north`. `north` walks up directories to find `.north/` (like git finds `.git/`).

All read commands support `--json` for machine-readable output (agents can't parse tables). No interactive prompts when stdin is not a TTY (agent-safe).

### Commands
```bash
north init                          # Initialize .north/ (scaffolds config, CLAUDE.md template)
north create "Title"                # Create a new issue
north list [--status X] [--json]    # List issues (filterable)
north show NOR-1 [--json]          # Show full issue details
north update NOR-1 --status done    # Update issue fields
north comment NOR-1 "message"       # Add a comment
north edit NOR-1                    # Open issue in $EDITOR
north context NOR-1 [--json]       # Output everything an agent needs
north session                       # Launch tmux layout (Claude Code + TUI)
```

### Context Command (Key for Agents)
```bash
north context NOR-1                 # Output everything an agent needs:
                                    #   - Project description
                                    #   - Issue details + all comments
                                    #   - Related/blocking issues
                                    #   - Relevant docs (if linked)
```

Output is deterministic — stable section ordering so diffs are meaningful.

This single command gives a coding agent full context to start working on an issue.

### Agent-Safety Guarantees
- `--json` on all read commands (agents can't parse tables)
- Atomic file writes (write to temp file, then rename) — no partial writes on crash
- Idempotent mutations (e.g., setting status to "done" when already done succeeds silently)
- No interactive prompts when stdin is not a TTY
- Deterministic `north context` output (stable section ordering)

## TUI Design

### Layout (standalone `north tui`)
```
┌────────────────────────────────────┐
│  Issue Board                       │
│                                    │
│  ┌──────┐  ┌──────┐  ┌──────┐    │
│  │ Todo │  │ Prog │  │ Done │    │
│  │      │  │      │  │      │    │
│  │NOR-1 │  │NOR-3 │  │NOR-5 │    │
│  │NOR-2 │  │NOR-4 │  │NOR-6 │    │
│  │      │  │      │  │      │    │
│  └──────┘  └──────┘  └──────┘    │
│                                    │
│  ── Issue Detail ────────────────  │
│  NOR-3: Implement auth             │
│  Status: In Progress               │
└────────────────────────────────────┘
```

### Layout (`north session` — tmux)
```
┌──────────────────┬────────────────────────────────┐
│  Claude Code     │  Issue Board                   │
│  (independent)   │                                │
│                  │  ┌──────┐ ┌──────┐ ┌──────┐   │
│  > help me plan  │  │ Todo │ │ Prog │ │ Done │   │
│    the auth      │  │      │ │      │ │      │   │
│    system        │  │NOR-1 │ │NOR-3 │ │NOR-5 │   │
│                  │  │NOR-2 │ │NOR-4 │ │NOR-6 │   │
│  Claude:         │  │      │ │      │ │      │   │
│  Here's my plan  │  └──────┘ └──────┘ └──────┘   │
│  for auth...     │                                │
│                  │  ── Issue Detail ────────────── │
│  > _             │  NOR-3: Implement auth          │
└──────────────────┴────────────────────────────────┘
```

- **Left pane (tmux):** Full Claude Code process. Independent — not embedded or managed by North.
- **Right pane:** Kanban board showing issues grouped by status. Watches `.north/` via fsnotify and auto-refreshes. Select an issue to see its detail.
- **Keyboard-driven:** vim-style navigation, shortcuts for common actions.
- **tea.Exec() fallback:** Pressing `c` in the TUI launches Claude Code fullscreen; TUI resumes when Claude exits.

### Key Interactions
- Navigate issues with `j/k` or arrow keys
- Press `Enter` to view issue detail
- Press `n` to create a new issue
- Press `s` to change status
- Press `c` to launch Claude Code (via tea.Exec())
- Press `?` for help

## Claude Code Integration

### CLAUDE.md Template
`north init` generates a `.north/CLAUDE.md` file that teaches agents how to use North:
- How to read project context (`north context NOR-1`)
- How to create/update issues (`north create`, `north update`)
- How to add comments when work is done
- How to check what's blocked and what to work on next
- Conventions for commit messages referencing issues

This file is picked up automatically by Claude Code when working in the repo.

### Skill: `north`
A Claude Code skill (installed at `~/.claude/skills/north.md` or bundled) that provides the same guidance for agents working outside the repo context.

### Future: Hooks (v2)
- **On session start:** Auto-inject active issue context into Claude Code
- **On compaction:** Re-inject critical project context so it survives context compression
- **On issue status change:** Trigger notifications or dependent workflows
- **Staleness detection:** Flag issues that haven't been updated in N days

## Milestones

### M1: Core CLI
- `north init` — scaffold `.north/` directory with CLAUDE.md template
- Flat commands: `north create/list/show/update/comment/edit`
- `north context` — deterministic full-context dump for an issue
- `--json` flag on all read commands
- Atomic file writes (write to temp, rename)
- `format_version: 1` in issue frontmatter
- Idempotent mutations, no TTY prompts when non-interactive
- Config file for project settings

### M2: TUI
- Bubble Tea-based terminal UI
- Kanban board view (3 columns: Todo, In Progress, Done)
- Issue detail view
- Keyboard navigation
- fsnotify file watcher for auto-refresh when `.north/` changes

### M3: Session Integration
- `north session` — launches tmux/Zellij layout (Claude Code + TUI)
- `tea.Exec()` fallback — press `c` to launch Claude Code fullscreen from TUI
- Context injection into Claude Code session

### M4: Skills & Hooks
- Claude Code skill for North workflows
- Session start hooks for context injection
- Compaction hooks for context preservation
- Staleness detection and notifications

### M5: Distribution
- Homebrew formula
- `go install` support
- Shell completions (zsh, bash, fish)
- Comprehensive help/docs

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
| Session | tmux/Zellij layout | Zero embedding code, both processes run at full fidelity |
| File writes | Atomic (temp + rename) | No partial writes on crash, safe for concurrent access |
| CLI style | Flat commands | Simpler for agents, less typing for humans |
| Agent output | `--json` flag | Agents can't parse tables; structured output is essential |
| Distribution | Standalone binary | `go install` + Homebrew, zero dependencies |
| Config | YAML | Simple, human-editable, well-supported in Go |
