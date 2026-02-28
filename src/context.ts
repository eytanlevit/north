import fs from "node:fs";
import path from "node:path";
import { readIssue, listIssues, type Issue } from "./issues.js";

export interface ContextOptions {
  cwd: string;
  issueId: string;
  json?: boolean;
}

export interface LinkedDoc {
  path: string;
  content: string;
}

export interface ContextResult {
  project?: string;
  issue: Issue;
  parentIssue?: Issue | { id: string; error: string };
  blockingIssues?: (Issue | { id: string; error: string })[];
  linkedDocs?: LinkedDoc[];
}

export function buildContext(options: ContextOptions): ContextResult {
  const { cwd, issueId } = options;
  const pmDir = path.join(cwd, ".pm");

  // 1. Read the main issue
  const issue = readIssue(cwd, issueId);
  if (!issue) {
    throw new Error(`Issue ${issueId} not found`);
  }

  const result: ContextResult = { issue };

  // 2. Project description
  const projectPath = path.join(pmDir, "project.md");
  if (fs.existsSync(projectPath)) {
    result.project = fs.readFileSync(projectPath, "utf-8").trim();
  }

  // 3. Parent issue
  if (issue.parent) {
    const parent = readIssue(cwd, issue.parent);
    result.parentIssue = parent ?? { id: issue.parent, error: "not found" };
  }

  // 4. Blocking issues
  if (issue.blocked_by && issue.blocked_by.length > 0) {
    result.blockingIssues = issue.blocked_by.map((blockerId) => {
      const blocker = readIssue(cwd, blockerId);
      return blocker ?? { id: blockerId, error: "not found" };
    });
  }

  // 5. Linked docs
  if (issue.docs && issue.docs.length > 0) {
    result.linkedDocs = issue.docs.map((docPath) => {
      const fullPath = path.join(pmDir, docPath);
      if (fs.existsSync(fullPath)) {
        return { path: docPath, content: fs.readFileSync(fullPath, "utf-8").trim() };
      }
      return { path: docPath, content: "[not found]" };
    });
  }

  return result;
}

export function formatContext(result: ContextResult): string {
  const sections: string[] = [];

  // Project
  if (result.project) {
    sections.push(`# Project\n\n${result.project}`);
  }

  // Main issue
  const i = result.issue;
  let issueSection = `# Issue: ${i.id}\n\n`;
  issueSection += `**Title:** ${i.title}\n`;
  issueSection += `**Status:** ${i.status}\n`;
  issueSection += `**Priority:** ${i.priority}\n`;
  issueSection += `**Created:** ${i.createdAt}\n`;
  if (i.body) {
    issueSection += `\n${i.body}`;
  }

  // Comments
  if (i.comments && i.comments.length > 0) {
    issueSection += `\n\n## Comments\n`;
    for (const c of i.comments) {
      issueSection += `\n**${c.author}** (${c.date}):\n${c.text}\n`;
    }
  }

  sections.push(issueSection);

  // Parent issue
  if (result.parentIssue) {
    let parentSection = `# Parent Issue\n\n`;
    if ("error" in result.parentIssue) {
      parentSection += `- ${result.parentIssue.id}: ${result.parentIssue.error}`;
    } else {
      const p = result.parentIssue;
      parentSection += `**${p.id}:** ${p.title} [${p.status}]`;
      if (p.body) {
        parentSection += `\n\n${p.body}`;
      }
    }
    sections.push(parentSection);
  }

  // Blocking issues
  if (result.blockingIssues && result.blockingIssues.length > 0) {
    let blockSection = `# Blocking Issues\n`;
    for (const b of result.blockingIssues) {
      if ("error" in b) {
        blockSection += `\n- ${b.id}: ${b.error}`;
      } else {
        blockSection += `\n- **${b.id}:** ${b.title} [${b.status}]`;
      }
    }
    sections.push(blockSection);
  }

  // Linked docs
  if (result.linkedDocs && result.linkedDocs.length > 0) {
    let docsSection = `# Linked Docs\n`;
    for (const d of result.linkedDocs) {
      docsSection += `\n## ${d.path}\n\n${d.content}`;
    }
    sections.push(docsSection);
  }

  return sections.join("\n\n---\n\n") + "\n";
}

export function formatContextJson(result: ContextResult): string {
  return JSON.stringify(result, null, 2);
}
