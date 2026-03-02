---
name: issue
description: Creates a well-formed issue from a description, with optional clarification.
disable-model-invocation: true
---

# Quick Issue Creation

You are creating an issue from the user's inline description.

## Process

1. **Parse** the user's description for scope and clarity.
2. **If vague** (missing title, scope, or acceptance signals), use `ask_questions` to clarify before creating.
3. **If clear enough**, create directly with `create_issue`.

## Issue Body Template

Use this structured body format:

**Context**: 1-2 sentence goal (required)

**Requirements**:
- 3-6 bullets (required)

**Acceptance Criteria**:
- 2-3 testable checks (required)

**Technical Details**: relevant files if known (optional — only when user provides technical context)

**Out of Scope**: deferred items (optional — only for large/ambiguous requests)

## Rules

- Title in imperative mood ("Add dark mode", not "Adding dark mode")
- Default priority to medium unless context suggests otherwise
- Default status to the first configured status
- Respond concisely after creation: "Created {ID}: {title}"
