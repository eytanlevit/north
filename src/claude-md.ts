/**
 * Generates the content for .north/CLAUDE.md — a guide for AI agents
 * on how to interact with north-managed projects.
 */
export function generateClaudeMd(): string {
  return `# Project Management with north

## Reading Context

To get full context for an issue (project description, issue details, comments, blocking issues, linked docs):

\`\`\`bash
npx tsx src/cli.ts context NOR-001
npx tsx src/cli.ts context NOR-001 --json  # for structured output
\`\`\`

## Issue Management

### List issues
\`\`\`bash
npx tsx src/cli.ts list
npx tsx src/cli.ts list --status todo
npx tsx src/cli.ts list --json
\`\`\`

### Show issue details
\`\`\`bash
npx tsx src/cli.ts show NOR-001
npx tsx src/cli.ts show NOR-001 --json
\`\`\`

### Create an issue
\`\`\`bash
npx tsx src/cli.ts create "Issue title" --priority high --body "Description here"
\`\`\`

### Update an issue
\`\`\`bash
npx tsx src/cli.ts update NOR-001 --status in-progress
npx tsx src/cli.ts update NOR-001 --status done --priority low
\`\`\`

### Add a comment
\`\`\`bash
npx tsx src/cli.ts comment NOR-001 "Work completed, see commit abc123"
\`\`\`

## Workflow

1. Check what needs to be done: \`npx tsx src/cli.ts list --status todo --json\`
2. Pick an issue and get context: \`npx tsx src/cli.ts context NOR-001\`
3. Mark it in-progress: \`npx tsx src/cli.ts update NOR-001 --status in-progress\`
4. Do the work
5. Add a comment: \`npx tsx src/cli.ts comment NOR-001 "Implemented X, see commit abc123"\`
6. Mark done: \`npx tsx src/cli.ts update NOR-001 --status done\`
7. Check for blocked issues that are now unblocked: \`npx tsx src/cli.ts list --json\`

## Commit Message Convention

Reference issue IDs in commit messages:

\`\`\`
feat(NOR-001): Add user authentication

Implements the auth flow described in NOR-001.
\`\`\`

## Project Structure

- \`.north/config.yaml\` — Project configuration (statuses, priorities)
- \`.north/project.md\` — Project description and goals
- \`.north/issues/\` — Issue files (YAML frontmatter + markdown body)
- \`.north/docs/\` — Linked documentation (PRDs, specs, schemas)
- \`.north/CLAUDE.md\` — This file (auto-generated)
`;
}
