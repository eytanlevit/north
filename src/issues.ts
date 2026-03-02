import fs from "node:fs";
import path from "node:path";
import { stringify, parse } from "yaml";

export type Status = string;
export type Priority = string;

export interface Comment {
  author: string;
  date: string;
  body: string;
}

export interface Issue {
  id: string;
  title: string;
  status: Status;
  priority: Priority;
  createdAt: string;
  body: string;
  comments?: Comment[];
  parent?: string;
  blocked_by?: string[];
  labels?: string[];
  docs?: string[];
}

type ChangeCallback = () => void;
const listeners: ChangeCallback[] = [];

export function onIssueChange(cb: ChangeCallback): () => void {
  listeners.push(cb);
  return () => {
    const idx = listeners.indexOf(cb);
    if (idx >= 0) listeners.splice(idx, 1);
  };
}

function notifyChange() {
  for (const cb of listeners) cb();
}

function issuesDir(cwd: string): string {
  return path.join(cwd, ".pm", "issues");
}

function issuePath(cwd: string, id: string): string {
  return path.join(issuesDir(cwd), `${id}.md`);
}

function ensureDir(cwd: string) {
  fs.mkdirSync(issuesDir(cwd), { recursive: true });
}

function parseIssueFile(content: string): Issue {
  const match = content.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!match) throw new Error("Invalid issue file: missing YAML frontmatter");
  const { format_version: _fv, ...frontmatter } = parse(match[1]) as Record<string, unknown>;
  return { ...(frontmatter as Omit<Issue, "body">), body: (match[2] ?? "").trim() };
}

function serializeIssue(issue: Issue): string {
  const { body, ...frontmatter } = issue;
  const data = { format_version: 1, ...frontmatter };
  return `---\n${stringify(data).trim()}\n---\n${body}\n`;
}

export function readIssue(cwd: string, id: string): Issue | null {
  const fp = issuePath(cwd, id);
  if (!fs.existsSync(fp)) return null;
  return parseIssueFile(fs.readFileSync(fp, "utf-8"));
}

export function writeIssue(cwd: string, issue: Issue): void {
  ensureDir(cwd);
  const fp = issuePath(cwd, issue.id);
  const tmp = fp + ".tmp";
  fs.writeFileSync(tmp, serializeIssue(issue), "utf-8");
  fs.renameSync(tmp, fp);
  notifyChange();
}

export function listIssues(cwd: string, filter?: { status?: Status }): Issue[] {
  const dir = issuesDir(cwd);
  if (!fs.existsSync(dir)) return [];
  const files = fs.readdirSync(dir).filter((f) => f.endsWith(".md"));
  const issues: Issue[] = [];
  for (const file of files) {
    try {
      const issue = parseIssueFile(fs.readFileSync(path.join(dir, file), "utf-8"));
      if (filter?.status && issue.status !== filter.status) continue;
      issues.push(issue);
    } catch {
      // skip malformed files
    }
  }
  issues.sort((a, b) => a.id.localeCompare(b.id));
  return issues;
}

export function deleteIssue(cwd: string, id: string): boolean {
  const fp = issuePath(cwd, id);
  if (!fs.existsSync(fp)) return false;
  fs.unlinkSync(fp);
  notifyChange();
  return true;
}

export function nextId(cwd: string, prefix = "ISS"): string {
  const dir = issuesDir(cwd);
  if (!fs.existsSync(dir)) return `${prefix}-001`;
  const files = fs.readdirSync(dir).filter((f) => f.endsWith(".md"));
  const re = new RegExp(`^${prefix}-(\\d+)\\.md$`);
  let max = 0;
  for (const f of files) {
    const m = f.match(re);
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  return `${prefix}-${String(max + 1).padStart(3, "0")}`;
}

export function watchIssueDir(cwd: string): () => void {
  const dir = issuesDir(cwd);
  if (!fs.existsSync(dir)) return () => {};
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;
  const watcher = fs.watch(dir, () => {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => notifyChange(), 200);
  });
  return () => {
    if (debounceTimer) clearTimeout(debounceTimer);
    watcher.close();
  };
}

export function addComment(cwd: string, id: string, comment: Comment): Issue {
  const issue = readIssue(cwd, id);
  if (!issue) throw new Error(`Issue ${id} not found`);
  if (!issue.comments) issue.comments = [];
  issue.comments.push(comment);
  writeIssue(cwd, issue);
  return issue;
}

export function validateRelationships(cwd: string, issue: Issue): string[] {
  const errors: string[] = [];
  const allIssues = listIssues(cwd);
  const ids = new Set(allIssues.map((i) => i.id));

  if (issue.parent && !ids.has(issue.parent)) {
    errors.push(`Parent ${issue.parent} does not exist`);
  }

  if (issue.blocked_by) {
    for (const dep of issue.blocked_by) {
      if (!ids.has(dep)) {
        errors.push(`Blocked-by reference ${dep} does not exist`);
        continue;
      }
      // Check circular: does the referenced issue block back on this issue?
      const other = allIssues.find((i) => i.id === dep);
      if (other?.blocked_by?.includes(issue.id)) {
        errors.push(`Circular blocked_by: ${issue.id} and ${dep} block each other`);
      }
    }
  }

  return errors;
}
