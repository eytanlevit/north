---
name: issue
description: Creates new issues or updates existing ones from a description, with optional clarification.
disable-model-invocation: true
---

# Issue Create / Update

You are creating or updating an issue based on the user's input.

## Detect Intent

- If the user's text contains an existing issue ID (pattern: `{PREFIX}-NNN`, e.g. PMT-008), treat as an **update**.
- Otherwise, treat as a **create**.

## Update Flow

1. Call `show_issue` to read the current issue.
2. Merge the user's requested changes with the existing content.
3. Call `update_issue` with the improved fields.
4. Respond: "Updated {ID}: {summary of changes}"

## Create Flow

1. **Parse** the user's description for scope and clarity.
2. **If vague** (missing title, scope, or acceptance signals), use `ask_questions` to clarify before creating.
3. **If clear enough**, create directly with `create_issue`.
4. Respond: "Created {ID}: {title}"

## Issue Body Template

Use this structured body format (for both create and update):

**Context**: 1-2 sentence goal (required)

**Requirements**:
- 3-6 bullets (required)

**Acceptance Criteria**:
- 2-3 testable checks (required)

**Technical Details**: relevant files if known (optional -- only when user provides technical context)

**Out of Scope**: deferred items (optional -- only for large/ambiguous requests)

## Rules

- Title in imperative mood ("Add dark mode", not "Adding dark mode")
- Default priority to medium unless context suggests otherwise
- Default status to the first configured status
- On update, preserve existing fields the user didn't ask to change
