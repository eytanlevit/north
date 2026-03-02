#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { stringify, parse } from "yaml";
import { findProjectRoot } from "./project-root.js";
import {
  readIssue,
  writeIssue,
  listIssues,
  nextId,
  type Status,
  type Priority,
  type Issue,
} from "./issues.js";
import { loadConfig } from "./config.js";

// ---------------------------------------------------------------------------
// Arg helpers
// ---------------------------------------------------------------------------

const args = process.argv.slice(2);
const command = args[0];

function getFlag(name: string): string | undefined {
  const idx = args.indexOf(`--${name}`);
  if (idx === -1 || idx + 1 >= args.length) return undefined;
  return args[idx + 1];
}

function hasFlag(name: string): boolean {
  return args.includes(`--${name}`);
}

/** Boolean flags that take no value. */
const BOOLEAN_FLAGS = new Set(["json"]);

/** Positional args that are NOT flags or flag values. */
function positionalArgs(): string[] {
  const positionals: string[] = [];
  let i = 1; // skip command
  while (i < args.length) {
    if (args[i].startsWith("--")) {
      const flagName = args[i].slice(2);
      if (BOOLEAN_FLAGS.has(flagName)) {
        i += 1; // boolean flag, no value
      } else {
        i += 2; // skip flag + value
      }
    } else {
      positionals.push(args[i]);
      i++;
    }
  }
  return positionals;
}

/** Whether output should be JSON (explicit flag or non-TTY stdout). */
function jsonOutput(): boolean {
  return hasFlag("json") || !process.stdout.isTTY;
}

/**
 * Normalize an ID argument to the canonical PREFIX-NNN format.
 * Accepts "NOR-001", "NOR-1", or plain "1".
 */
function normalizeId(raw: string, cwd: string): string {
  // Read config prefix (default NOR)
  let prefix = "NOR";
  const configPath = path.join(cwd, ".north", "config.yaml");
  if (fs.existsSync(configPath)) {
    try {
      const cfg = parse(fs.readFileSync(configPath, "utf-8"));
      if (cfg?.prefix) prefix = cfg.prefix;
    } catch {
      // use default
    }
  }

  // Already full format?
  const fullMatch = raw.match(new RegExp(`^${prefix}-(\\d+)$`));
  if (fullMatch) {
    return `${prefix}-${fullMatch[1].padStart(3, "0")}`;
  }

  // Plain number?
  const numMatch = raw.match(/^(\d+)$/);
  if (numMatch) {
    return `${prefix}-${numMatch[1].padStart(3, "0")}`;
  }

  return raw; // return as-is, let readIssue fail with not-found
}

// ---------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------

const VALID_STATUSES: Status[] = ["todo", "in-progress", "done"];
const VALID_PRIORITIES: Priority[] = ["low", "medium", "high"];

function validateStatus(s: string): Status {
  if (!VALID_STATUSES.includes(s as Status)) {
    throw new Error(
      `Invalid status "${s}". Must be one of: ${VALID_STATUSES.join(", ")}`
    );
  }
  return s as Status;
}

function validatePriority(p: string): Priority {
  if (!VALID_PRIORITIES.includes(p as Priority)) {
    throw new Error(
      `Invalid priority "${p}". Must be one of: ${VALID_PRIORITIES.join(", ")}`
    );
  }
  return p as Priority;
}

// ---- init -----------------------------------------------------------------

function cmdInit() {
  const cwd = process.cwd();
  const pmDir = path.join(cwd, ".north");

  if (fs.existsSync(pmDir)) {
    console.error("Project already initialized (.north/ exists).");
    process.exit(1);
  }

  fs.mkdirSync(path.join(pmDir, "issues"), { recursive: true });
  fs.mkdirSync(path.join(pmDir, "docs"), { recursive: true });

  const config = {
    prefix: "NOR",
    name: "",
    description: "",
    statuses: ["todo", "in-progress", "done"],
    priorities: ["high", "medium", "low"],
  };

  const configPath = path.join(pmDir, "config.yaml");
  const tmpConfig = configPath + ".tmp";
  fs.writeFileSync(tmpConfig, stringify(config), "utf-8");
  fs.renameSync(tmpConfig, configPath);

  const projectMd = path.join(pmDir, "project.md");
  const tmpProject = projectMd + ".tmp";
  fs.writeFileSync(tmpProject, "# Project\n\nDescribe your project here.\n", "utf-8");
  fs.renameSync(tmpProject, projectMd);

  console.log("Initialized north project in .north/");
}

// ---- create ---------------------------------------------------------------

function cmdCreate() {
  const cwd = findProjectRoot();
  const pos = positionalArgs();
  const title = pos[0];

  if (!title) {
    console.error('Usage: north create "Title" [--status STATUS] [--priority PRIORITY] [--body "text"]');
    process.exit(1);
  }

  const status = getFlag("status") ? validateStatus(getFlag("status")!) : "todo";
  const priority = getFlag("priority") ? validatePriority(getFlag("priority")!) : "medium";
  const body = getFlag("body") ?? "";

  const config = loadConfig(cwd);
  const id = nextId(cwd, config.prefix);
  const issue: Issue = {
    id,
    title,
    status,
    priority,
    createdAt: new Date().toISOString(),
    body,
  };

  writeIssue(cwd, issue);

  if (jsonOutput()) {
    console.log(JSON.stringify(issue, null, 2));
  } else {
    console.log(`Created ${id}: ${title}`);
  }
}

// ---- list -----------------------------------------------------------------

function cmdList() {
  const cwd = findProjectRoot();
  const statusFilter = getFlag("status");
  const filter = statusFilter ? { status: validateStatus(statusFilter) } : undefined;
  const issues = listIssues(cwd, filter);

  if (jsonOutput()) {
    console.log(JSON.stringify(issues, null, 2));
    return;
  }

  if (issues.length === 0) {
    console.log("No issues found.");
    return;
  }

  // Human-readable table
  const header = "ID        | Status       | Priority | Title";
  const sep = "--------- | ------------ | -------- | -----";
  console.log(header);
  console.log(sep);
  for (const iss of issues) {
    const id = iss.id.padEnd(9);
    const st = iss.status.padEnd(12);
    const pr = iss.priority.padEnd(8);
    console.log(`${id} | ${st} | ${pr} | ${iss.title}`);
  }
}

// ---- show -----------------------------------------------------------------

function cmdShow() {
  const cwd = findProjectRoot();
  const pos = positionalArgs();
  const rawId = pos[0];

  if (!rawId) {
    console.error("Usage: north show ID [--json]");
    process.exit(1);
  }

  const id = normalizeId(rawId, cwd);
  const issue = readIssue(cwd, id);

  if (!issue) {
    console.error(`Issue ${id} not found.`);
    process.exit(1);
  }

  if (jsonOutput()) {
    console.log(JSON.stringify(issue, null, 2));
    return;
  }

  console.log(`ID:       ${issue.id}`);
  console.log(`Title:    ${issue.title}`);
  console.log(`Status:   ${issue.status}`);
  console.log(`Priority: ${issue.priority}`);
  console.log(`Created:  ${issue.createdAt}`);
  if (issue.body) {
    console.log(`\n${issue.body}`);
  }
}

// ---- update ---------------------------------------------------------------

function cmdUpdate() {
  const cwd = findProjectRoot();
  const pos = positionalArgs();
  const rawId = pos[0];

  if (!rawId) {
    console.error("Usage: north update ID [--status STATUS] [--priority PRIORITY] [--title TITLE] [--body BODY]");
    process.exit(1);
  }

  const id = normalizeId(rawId, cwd);
  const issue = readIssue(cwd, id);

  if (!issue) {
    console.error(`Issue ${id} not found.`);
    process.exit(1);
  }

  const newTitle = getFlag("title");
  const newStatus = getFlag("status");
  const newPriority = getFlag("priority");
  const newBody = getFlag("body");

  if (newTitle !== undefined) issue.title = newTitle;
  if (newStatus !== undefined) issue.status = validateStatus(newStatus);
  if (newPriority !== undefined) issue.priority = validatePriority(newPriority);
  if (newBody !== undefined) issue.body = newBody;

  writeIssue(cwd, issue);

  if (jsonOutput()) {
    console.log(JSON.stringify(issue, null, 2));
  } else {
    console.log(`Updated ${id}: ${issue.title} [${issue.status}]`);
  }
}

// ---- comment --------------------------------------------------------------

function cmdComment() {
  const cwd = findProjectRoot();
  const pos = positionalArgs();
  const rawId = pos[0];
  const message = pos[1];

  if (!rawId || !message) {
    console.error('Usage: north comment ID "message" [--author AUTHOR]');
    process.exit(1);
  }

  const id = normalizeId(rawId, cwd);
  const issue = readIssue(cwd, id);

  if (!issue) {
    console.error(`Issue ${id} not found.`);
    process.exit(1);
  }

  const author = getFlag("author") ?? "user";
  const date = new Date().toISOString();

  // Append comment to body as a markdown section
  const commentBlock = `\n\n---\n**${author}** (${date}):\n${message}`;
  issue.body = (issue.body ?? "") + commentBlock;

  writeIssue(cwd, issue);

  if (jsonOutput()) {
    console.log(JSON.stringify({ id, author, date, message }, null, 2));
  } else {
    console.log(`Added comment to ${id} by ${author}.`);
  }
}

// ---- help -----------------------------------------------------------------

function printHelp() {
  const help = `north - Project management TUI & CLI

Usage: north <command> [options]

Commands:
  init                              Initialize a new project (.north/ directory)
  create "Title" [options]          Create a new issue
    --status STATUS                 Status: todo, in-progress, done (default: todo)
    --priority PRIORITY             Priority: low, medium, high (default: medium)
    --body "text"                   Issue body text
  list [options]                    List all issues
    --status STATUS                 Filter by status
    --json                          Output as JSON
  show ID [options]                 Show issue details
    --json                          Output as JSON
  update ID [options]               Update an issue
    --status STATUS                 New status
    --priority PRIORITY             New priority
    --title "text"                  New title
    --body "text"                   New body
  comment ID "message" [options]    Add a comment to an issue
    --author AUTHOR                 Comment author (default: user)
  help                              Show this help message

Notes:
  - ID can be "NOR-001" or just "1"
  - When stdout is not a TTY, output defaults to JSON
`;
  console.log(help);
}

// ---------------------------------------------------------------------------
// Main dispatch
// ---------------------------------------------------------------------------

try {
  switch (command) {
    case "init":
      cmdInit();
      break;
    case "create":
      cmdCreate();
      break;
    case "list":
    case "ls":
      cmdList();
      break;
    case "show":
      cmdShow();
      break;
    case "update":
      cmdUpdate();
      break;
    case "comment":
      cmdComment();
      break;
    case "help":
    case "--help":
    case "-h":
    case undefined:
      printHelp();
      break;
    default:
      console.error(`Unknown command: ${command}\n`);
      printHelp();
      process.exit(1);
  }
} catch (err: unknown) {
  const message = err instanceof Error ? err.message : String(err);
  console.error(`Error: ${message}`);
  process.exit(1);
}
