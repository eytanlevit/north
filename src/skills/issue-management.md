---
name: issue-management
description: Detailed guide for managing project issues in pmtui
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
