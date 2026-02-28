# pmtui — Implementation Tasks

Implementation order reflects dependencies. Tasks 1+9 merged. Tasks 4+5+6 grouped.

---

## Phase 1: Foundation

### Task 1. Project Config + Configurable Statuses/Priorities

Add `.pm/project.md` and `.pm/config.yaml` to define a project. Replace all hardcoded statuses/priorities with config-driven values.

- `project.md` — freeform markdown describing the project (vision, goals, context)
- `config.yaml` — structured settings:
  ```yaml
  prefix: ISS
  name: "My Project"
  description: "Short description"
  statuses: [todo, in-progress, done]
  priorities: [high, medium, low]
  ```
- `pmtui init` scaffolds `.pm/` with default config, empty project.md, and issues/docs dirs
- `issues.ts` — `Status` and `Priority` types become dynamic (string validated against config)
- `kanban-pane.ts` — `SECTIONS` array built from config statuses
- Agent tools — validate against config values
- Sensible defaults when no config exists (todo/in-progress/done, high/medium/low)
- Add `format_version: 1` to issue frontmatter for future schema compat
- Migration: existing issues with old statuses/priorities continue to work
- Config validation: invalid values produce clear errors, no silent fallbacks

---

## Phase 2: Issue Schema

### Task 2. Comments

Structured comments on issues, stored as a YAML array in frontmatter.

```yaml
comments:
  - author: user
    date: "2026-02-28"
    body: |
      Started work on this.
```

- Agent tool `add_comment` appends a comment
- Comments show in issue detail view and `context` output
- YAML array parsing/writing must be stable and idempotent

### Task 3. Relationships

Add `parent` and `blocked_by` fields to issues.

- `parent: ISS-001` — makes this a sub-task of ISS-001
- `blocked_by: [ISS-002, ISS-003]` — this issue can't start until those are done
- Validate references: unknown IDs and circular `blocked_by` chains produce clear errors
- `context` command includes blocking issue details
- Board/list view shows relationship indicators (e.g. blocked icon, sub-task indent)

### Task 4. Labels

Freeform tags on issues.

- `labels: [auth, backend, urgent]` field in frontmatter
- Displayed in board and detail views

---

## Phase 3: CLI

### Task 5. CLI

Standalone CLI commands. Separate entry point from the TUI (`src/cli.ts`).

Commands:
- `init` — scaffold `.pm/` directory
- `create "Title"` — create a new issue
- `list [--status X] [--json]` — list issues, filterable
- `show ISS-1 [--json]` — show full issue details
- `update ISS-1 --status done` — update issue fields
- `comment ISS-1 "message"` — add a comment
- `context ISS-1 [--json]` — dump full context for an issue

Requirements:
- All read commands support `--json` for agent-safe output
- No interactive prompts when stdin is not a TTY
- Walks up directories to find `.pm/` (like git finds `.git/`)
- CLI and agent tools share the same service layer (no drift)
- ID generation derived from filesystem scan (not config next_id)

### Task 6. Docs

Add a `.pm/docs/` folder for attached documents (PRDs, specs, schemas).

- Issues get a `docs: [docs/prd.md]` frontmatter field linking to files in `.pm/docs/`
- `context` command includes linked doc contents in output
- `init` creates the empty `docs/` dir

### Task 7. Context Command

Single command that dumps everything an agent needs for an issue.

Output sections (deterministic order):
1. Project description (from `project.md`)
2. Issue details + all comments
3. Blocking issues (from `blocked_by`)
4. Linked docs (from `docs` field)

Supports `--json` for structured output. This is the key agent integration point.

Depends on: Tasks 2, 3, 6.

### Task 8. CLAUDE.md Generation

`init` generates a `.pm/CLAUDE.md` teaching agents how to use pmtui.

Contents:
- How to read project context (`pmtui context ISS-1`)
- How to create/update issues (`pmtui create`, `pmtui update`)
- How to add comments when work is done
- How to check what's blocked and what to work on next
- Conventions for commit messages referencing issues

Auto-generated, not hand-written. Depends on: stable CLI + context output.

---

## Phase 4: TUI

### Task 9. Per-Pane Scrolling

Vertical scrolling for each pane independently, via keyboard and mouse.

- Kanban pane: scroll when issues overflow visible height
- Chat pane: scroll through message history
- Keyboard: arrow keys / j/k when pane is focused
- Mouse: scroll wheel targets the pane under cursor
- Tab to switch focus between panes
- Scroll position indicator (e.g. "3/10" or scrollbar)

### Task 10. Issue Detail View

Expand a selected issue to see its full details.

- Navigate to an issue in the kanban pane and press Enter
- Detail view shows: title, status, priority, labels, parent, blocked_by, body, comments, linked docs
- Scrollable content area for long issues
- Esc/b to return to board view
- Keyboard shortcut to edit status/priority inline

---

## Cross-Cutting Concerns

These apply across all tasks:

- **Project root discovery** — walk up dirs to find `.pm/` (like git finds `.git/`)
- **Concurrency safety** — TUI and CLI may touch the same files simultaneously; use atomic writes (temp + rename)
- **Tests** — parser, config loading, CLI JSON contract, context output shape, relationship resolution
- **Shared service layer** — CLI commands and agent tools must use the same issue/config read/write logic
