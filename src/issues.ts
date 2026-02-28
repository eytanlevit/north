import fs from "node:fs";
import path from "node:path";
import { stringify, parse } from "yaml";

export type Status = "todo" | "in-progress" | "done";
export type Priority = "low" | "medium" | "high";

export interface Issue {
  id: string;
  title: string;
  status: Status;
  priority: Priority;
  createdAt: string;
  body: string;
  docs?: string[];
  blocked_by?: string[];
  parent?: string;
  comments?: Comment[];
}

export interface Comment {
  author: string;
  date: string;
  text: string;
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
  const frontmatter = parse(match[1]) as Omit<Issue, "body">;
  return { ...frontmatter, body: match[2].trim() };
}

function serializeIssue(issue: Issue): string {
  const { body, ...frontmatter } = issue;
  return `---\n${stringify(frontmatter).trim()}\n---\n${body}\n`;
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

export function nextId(cwd: string): string {
  const dir = issuesDir(cwd);
  if (!fs.existsSync(dir)) return "ISS-001";
  const files = fs.readdirSync(dir).filter((f) => f.endsWith(".md"));
  let max = 0;
  for (const f of files) {
    const m = f.match(/^ISS-(\d+)\.md$/);
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  return `ISS-${String(max + 1).padStart(3, "0")}`;
}
