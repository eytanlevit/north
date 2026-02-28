import type { Component } from "@mariozechner/pi-tui";
import { visibleWidth, truncateToWidth } from "@mariozechner/pi-tui";
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

  constructor(cwd: string) {
    this.cwd = cwd;
    this.issues = listIssues(cwd);
  }

  refresh(): void {
    this.issues = listIssues(this.cwd);
    this.cachedLines = undefined;
    this.cachedWidth = undefined;
  }

  invalidate(): void {
    this.cachedLines = undefined;
    this.cachedWidth = undefined;
  }

  render(width: number): string[] {
    if (this.cachedLines && this.cachedWidth === width) return this.cachedLines;

    const grouped = new Map<Status, Issue[]>();
    for (const s of SECTIONS) grouped.set(s.status, []);
    for (const issue of this.issues) {
      grouped.get(issue.status)?.push(issue);
    }

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
          lines.push(renderIssueRow(issue, width));
        }
      }
    }

    this.cachedLines = lines;
    this.cachedWidth = width;
    return lines;
  }
}

function renderIssueRow(issue: Issue, width: number): string {
  const priorityChar = issue.priority[0].toUpperCase();
  const colorFn = PRIORITY_COLOR[issue.priority] ?? chalk.dim;
  const blocked = issue.blocked_by?.length ? chalk.red(" \u2298") : "";
  const labelTags = issue.labels?.length
    ? " " + issue.labels.map((l) => chalk.bgBlue.white(` ${l} `)).join(" ")
    : "";
  const suffix = blocked + labelTags;
  const suffixVw = visibleWidth(suffix);
  const prefix = `   ${colorFn(`[${priorityChar}]`)} ${chalk.dim(issue.id)} `;
  const prefixVw = visibleWidth(prefix);
  const remaining = width - prefixVw - suffixVw;
  if (remaining <= 0) return truncateToWidth(prefix + suffix, width, "", true);
  const title = truncateToWidth(issue.title, remaining, "\u2026", true);
  return prefix + title + suffix;
}

function pad(line: string, width: number): string {
  const vw = visibleWidth(line);
  if (vw >= width) return truncateToWidth(line, width, "", true);
  return line + " ".repeat(width - vw);
}
