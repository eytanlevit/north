# North

> A North Star for your projects.

Filesystem-based project management for developers and AI coding agents. Issues are markdown files with YAML frontmatter -- git-trackable, human-readable, agent-friendly.

## Why North?

AI coding agents need structured project context. Existing tools (Jira, Linear, GitHub Issues) are web-first and disconnected from your codebase. North makes project management **filesystem-native**:

- Issues are markdown files you can read and edit by hand
- Everything lives in your repo and is git-tracked
- Agents interact via simple CLI commands with `--json` output
- Humans get a rich terminal UI for visual oversight

## Install

### Go

```sh
go install github.com/eytanlevit/north/cmd/north@latest
```

### Homebrew

```sh
brew install eytanlevit/tap/north
```

### From Source

```sh
git clone https://github.com/eytanlevit/north.git
cd north
go build -o north ./cmd/north/
```

## Quick Start

```sh
# Initialize a project
north init

# Create issues
north create "Set up authentication" --priority high --label backend
north create "Design landing page" --priority medium --label frontend

# View your board
north tui

# Get full context for an agent
north context NOR-1

# Launch agent session (Claude Code + kanban board)
north session NOR-1
```

## Commands

| Command | Description |
|---------|-------------|
| `north init` | Initialize `.north/` in current directory |
| `north create "Title"` | Create a new issue |
| `north list [--status X] [--json]` | List issues |
| `north show <ID> [--json]` | Show issue details |
| `north update <ID> --status done` | Update issue fields |
| `north comment <ID> "msg"` | Add a comment |
| `north edit <ID>` | Open in $EDITOR |
| `north context <ID> [--json]` | Full context dump for agents |
| `north stale [--days N] [--json]` | Find stale issues |
| `north tui` | Interactive kanban board |
| `north session [ID]` | Agent chat + kanban board |
| `north skill install` | Install Claude Code skill |
| `north completion bash\|zsh\|fish` | Shell completions |

## How It Works

Issues are stored as markdown files with YAML frontmatter in `.north/issues/`:

```yaml
---
id: NOR-1
title: Set up authentication
status: in-progress
priority: high
labels: [backend, auth]
created: "2026-02-28"
updated: "2026-02-28"
---

## Description
Implement JWT-based auth for the API...
```

The TUI watches these files via fsnotify and updates the kanban board in real-time.

## Agent Integration

North is designed for AI coding agents. Install the Claude Code skill:

```sh
north skill install
```

Or use the generated `.north/CLAUDE.md` (created by `north init`) which teaches agents how to use North.

## License

MIT
