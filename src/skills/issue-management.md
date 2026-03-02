---
name: issue-management
description: Detailed guide for managing project issues in north
---

# Issue Management Guide

## Creating Issues

When creating issues, follow these conventions:
- **Title**: Use imperative mood ("Add authentication", not "Adding authentication")
- **Priority**: Use "high" for blockers/critical bugs, "medium" for normal work, "low" for nice-to-have
- **Status**: New issues default to the first configured status (usually "todo")

## Creating Epics

When asked to create an epic or large feature:
1. First use `ask_questions` to clarify scope and requirements
2. Create a parent issue for the epic itself
3. Create child issues for each sub-task, setting their `parent` field to the epic's ID
4. Set `blocked_by` relationships where tasks have dependencies

## Asking Questions

Use `ask_questions` to gather preferences or clarify requirements. Each question must include:
- **id**: Unique identifier (e.g., "scope", "priority")
- **prompt**: The full question text
- **options**: Array of choices, each with `value`, `label`, and optional `description`
- **label** (optional): Short tab-bar label (defaults to Q1, Q2, etc.)
- **allowOther** (optional): Whether to show a "Type something" free-text option (default: true)

Options can include a **markdown** field with ASCII/text preview content that renders in a side-by-side panel when the option is focused. Use this for layout mockups, code snippets, or comparison previews.

Example:
```json
{
  "questions": [
    {
      "id": "scope",
      "label": "Scope",
      "prompt": "What scope should this feature cover?",
      "options": [
        { "value": "minimal", "label": "Minimal MVP", "description": "Core functionality only" },
        { "value": "full", "label": "Full feature", "description": "Including edge cases and polish" }
      ]
    }
  ]
}
```

## Updating Issues

- When moving issues between statuses, use `update_issue` with the `status` field
- When reprioritizing, update the `priority` field
- Add comments to track decisions and progress

## Exploring the Codebase

Before creating technically-informed issues:
1. Use `read` to examine relevant source files
2. Use `grep` to search for patterns and dependencies
3. Use `find` to discover file structure
4. Use `bash` to run build commands, tests, or git operations for context
