import type { Component } from "@mariozechner/pi-tui";
import { visibleWidth, truncateToWidth, matchesKey } from "@mariozechner/pi-tui";
import chalk from "chalk";
import { listIssues, type Issue, type Status } from "../issues.js";

const SECTIONS: { status: Status; label: string; icon: string }[] = [
  { status: "todo", label: "TODO", icon: "○" },
  { status: "in-progress", label: "IN PROGRESS", icon: "◑" },
  { status: "done", label: "DONE", icon: "●" },
];

const PRIORITY_COLOR: Record<string, (s: string) => string> = {
  high: chalk.red,
  medium: chalk.yellow,
  low: chalk.dim,
};

export class KanbanPane implements Component {
  private cwd: string;
  private issues: Issue[] = [];
  private cachedLines?: string[];
  private cachedWidth?: number;
  private cursorIndex = 0;
  focused = false;
  onSelectIssue?: (issue: Issue) => void;

  constructor(cwd: string) {
    this.cwd = cwd;
    this.issues = listIssues(cwd);
  }

  refresh(): void {
    this.issues = listIssues(this.cwd);
    // Clamp cursor after refresh in case issues were removed
    if (this.cursorIndex >= this.issues.length) {
      this.cursorIndex = Math.max(0, this.issues.length - 1);
    }
    this.cachedLines = undefined;
    this.cachedWidth = undefined;
  }

  invalidate(): void {
    this.cachedLines = undefined;
    this.cachedWidth = undefined;
  }

  handleInput(data: string): void {
    if (matchesKey(data, "enter") || matchesKey(data, "return")) {
      const issue = this.getSelectedIssue();
      if (issue) this.onSelectIssue?.(issue);
      return;
    }
    if (matchesKey(data, "j") || matchesKey(data, "down")) {
      this.moveCursorDown();
      return;
    }
    if (matchesKey(data, "k") || matchesKey(data, "up")) {
      this.moveCursorUp();
      return;
    }
  }

  getSelectedIssue(): Issue | null {
    const allIssues = this.getAllIssues();
    if (allIssues.length === 0) return null;
    return allIssues[this.cursorIndex] ?? null;
  }

  /** Flat list of all issues in display order (grouped by section) */
  getAllIssues(): Issue[] {
    const grouped = new Map<Status, Issue[]>();
    for (const s of SECTIONS) grouped.set(s.status, []);
    for (const issue of this.issues) {
      grouped.get(issue.status)?.push(issue);
    }
    const result: Issue[] = [];
    for (const section of SECTIONS) {
      result.push(...grouped.get(section.status)!);
    }
    return result;
  }

  private moveCursorDown(): void {
    const allIssues = this.getAllIssues();
    if (allIssues.length === 0) return;
    if (this.cursorIndex < allIssues.length - 1) {
      this.cursorIndex++;
      this.cachedLines = undefined;
      this.cachedWidth = undefined;
    }
  }

  private moveCursorUp(): void {
    if (this.cursorIndex > 0) {
      this.cursorIndex--;
      this.cachedLines = undefined;
      this.cachedWidth = undefined;
    }
  }

  render(width: number): string[] {
    if (this.cachedLines && this.cachedWidth === width) return this.cachedLines;

    const grouped = new Map<Status, Issue[]>();
    for (const s of SECTIONS) grouped.set(s.status, []);
    for (const issue of this.issues) {
      grouped.get(issue.status)?.push(issue);
    }

    // Build flat issue list to map cursor index to issue
    const allIssues = this.getAllIssues();
    const selectedIssue = allIssues[this.cursorIndex] ?? null;

    const lines: string[] = [];

    // Title
    lines.push(pad(chalk.bold(" BOARD") + chalk.dim(` (${this.issues.length})`), width));
    lines.push(pad(chalk.dim(" " + "─".repeat(width - 2)), width));

    for (const section of SECTIONS) {
      const issues = grouped.get(section.status)!;
      // Section header
      lines.push(pad("", width));
      lines.push(pad(` ${chalk.bold.cyan(section.icon + " " + section.label)} ${chalk.dim(`(${issues.length})`)}`, width));

      if (issues.length === 0) {
        lines.push(pad(chalk.dim("   No issues"), width));
      } else {
        for (const issue of issues) {
          const isSelected = this.focused && selectedIssue?.id === issue.id;
          lines.push(renderIssueRow(issue, width, isSelected));
        }
      }
    }

    this.cachedLines = lines;
    this.cachedWidth = width;
    return lines;
  }
}

function renderIssueRow(issue: Issue, width: number, selected: boolean): string {
  const priorityChar = issue.priority[0].toUpperCase();
  const colorFn = PRIORITY_COLOR[issue.priority] ?? chalk.dim;
  const pointer = selected ? chalk.cyan(" > ") : "   ";
  const prefix = `${pointer}${colorFn(`[${priorityChar}]`)} ${chalk.dim(issue.id)} `;
  const prefixVw = visibleWidth(prefix);
  const remaining = width - prefixVw;
  if (remaining <= 0) return truncateToWidth(prefix, width, "", true);
  const titleText = truncateToWidth(issue.title, remaining, "…", true);
  const title = selected ? chalk.bold.cyan(titleText) : titleText;
  const line = prefix + title;
  if (selected) {
    return pad(line, width);
  }
  return pad(line, width);
}

function pad(line: string, width: number): string {
  const vw = visibleWidth(line);
  if (vw >= width) return truncateToWidth(line, width, "", true);
  return line + " ".repeat(width - vw);
}
