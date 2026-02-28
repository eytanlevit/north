# pmtui — Implementation Tasks

## 1. Project Config

Add `.pm/project.md` and `.pm/config.yaml` to define a project.

- `project.md` — freeform markdown describing the project (vision, goals, context)
- `config.yaml` — structured settings:
  ```yaml
  prefix: ISS          # issue ID prefix
  name: "My Project"
  description: "Short description"
  next_id: 4
  statuses: [todo, in-progress, done]
  priorities: [high, medium, low]
  ```
- `pmtui init` scaffolds `.pm/` with default config, empty project.md, and issues/docs dirs
- All code that currently hardcodes statuses/priorities should read from config instead

## 2. CLI

Standalone CLI commands (run via `npx pmtui <cmd>` or `node dist/cli.js <cmd>`).

Commands:
- `init` — scaffold `.pm/` directory
- `create "Title"` — create a new issue
- `list [--status X] [--json]` — list issues, filterable
- `show ISS-1 [--json]` — show full issue details
- `update ISS-1 --status done` — update issue fields
- `comment ISS-1 "message"` — add a comment
- `context ISS-1 [--json]` — dump full context for an issue

All read commands support `--json` for agent-safe output. No interactive prompts when stdin is not a TTY. Walks up directories to find `.pm/` (like git finds `.git/`).

Separate entry point from the TUI (`src/cli.ts`).

## 3. Docs

Add a `.pm/docs/` folder for attached documents (PRDs, specs, schemas).

- Issues get a `docs: [docs/prd.md]` frontmatter field linking to files in `.pm/docs/`
- `context` command includes linked doc contents in output
- `init` creates the empty `docs/` dir

## 4. Comments

Structured comments on issues, stored as a YAML array in frontmatter.

```yaml
comments:
  - author: user
    date: "2026-02-28"
    body: |
      Started work on this.
```

- CLI `comment` command appends a comment
- Agent tool `add_comment` does the same
- Comments show in issue detail view and `context` output

## 5. Relationships

Add `parent` and `blocked_by` fields to issues.

- `parent: ISS-001` — makes this a sub-task of ISS-001
- `blocked_by: [ISS-002, ISS-003]` — this issue can't start until those are done
- `context` command includes blocking issue details
- Board/list view shows relationship indicators (e.g. blocked icon, sub-task indent)

## 6. Labels

Freeform tags on issues.

- `labels: [auth, backend, urgent]` field in frontmatter
- CLI: `--label` flag on create/update
- Displayed in board and detail views

## 7. Context Command

Single command that dumps everything an agent needs for an issue.

Output sections (deterministic order):
1. Project description (from `project.md`)
2. Issue details + all comments
3. Blocking issues (from `blocked_by`)
4. Linked docs (from `docs` field)

Supports `--json` for structured output. This is the key agent integration point.

## 8. CLAUDE.md Generation

`init` generates a `.pm/CLAUDE.md` teaching agents how to use pmtui.

Contents:
- How to read project context (`pmtui context ISS-1`)
- How to create/update issues (`pmtui create`, `pmtui update`)
- How to add comments when work is done
- How to check what's blocked and what to work on next
- Conventions for commit messages referencing issues

Auto-generated, not hand-written.

## 9. Configurable Statuses & Priorities

Replace hardcoded `"todo" | "in-progress" | "done"` and `"low" | "medium" | "high"` with values from `config.yaml`.

- `issues.ts` — `Status` and `Priority` types become dynamic (string validated against config)
- `kanban-pane.ts` — `SECTIONS` array built from config statuses
- Agent tools — validate against config values
- Sensible defaults when no config exists

## 10. Per-Pane Scrolling

Vertical scrolling for each pane independently, via keyboard and mouse.

- Kanban pane: scroll when issues overflow visible height
- Chat pane: scroll through message history
- Keyboard: arrow keys / j/k when pane is focused
- Mouse: scroll wheel targets the pane under cursor
- Tab to switch focus between panes
- Scroll position indicator (e.g. "3/10" or scrollbar)

## 11. Issue Detail View

Expand a selected issue to see its full details.

- Navigate to an issue in the kanban pane and press Enter
- Detail view shows: title, status, priority, labels, parent, blocked_by, body, comments, linked docs
- Scrollable content area for long issues
- Esc/b to return to board view
- Keyboard shortcut to edit status/priority inline
