import type { Component } from "@mariozechner/pi-tui";
import { visibleWidth, truncateToWidth } from "@mariozechner/pi-tui";
import chalk from "chalk";
import { listIssues, type Issue, type Status } from "../issues.js";

const COLUMNS: { status: Status; label: string }[] = [
  { status: "todo", label: "TODO" },
  { status: "in-progress", label: "IN PROGRESS" },
  { status: "done", label: "DONE" },
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
    for (const col of COLUMNS) grouped.set(col.status, []);
    for (const issue of this.issues) {
      grouped.get(issue.status)?.push(issue);
    }

    const colWidth = Math.floor((width - COLUMNS.length + 1) / COLUMNS.length);
    const lastColWidth = width - colWidth * (COLUMNS.length - 1) - (COLUMNS.length - 1);

    // Header
    const headerParts = COLUMNS.map((col, i) => {
      const w = i === COLUMNS.length - 1 ? lastColWidth : colWidth;
      const count = grouped.get(col.status)!.length;
      const label = `${col.label} (${count})`;
      return padLine(chalk.bold.cyan(label), w);
    });
    const headerLine = headerParts.join(chalk.dim("│"));

    // Separator
    const sepParts = COLUMNS.map((_, i) => {
      const w = i === COLUMNS.length - 1 ? lastColWidth : colWidth;
      return chalk.dim("─".repeat(w));
    });
    const sepLine = sepParts.join(chalk.dim("┼"));

    // Title
    const totalIssues = this.issues.length;
    const titleLine = padLine(chalk.bold(" BOARD") + chalk.dim(` (${totalIssues})`), width);

    const lines: string[] = [titleLine, padLine("", width), headerLine, sepLine];

    // Find max cards in any column
    const maxCards = Math.max(1, ...Array.from(grouped.values()).map((a) => a.length));

    for (let row = 0; row < maxCards; row++) {
      const rowParts = COLUMNS.map((col, i) => {
        const w = i === COLUMNS.length - 1 ? lastColWidth : colWidth;
        const issues = grouped.get(col.status)!;
        if (row >= issues.length) return " ".repeat(w);
        const issue = issues[row];
        return renderCard(issue, w);
      });
      lines.push(rowParts.join(chalk.dim("│")));
    }

    // Pad to fill screen
    while (lines.length < 20) {
      lines.push(" ".repeat(width));
    }

    this.cachedLines = lines;
    this.cachedWidth = width;
    return lines;
  }
}

function renderCard(issue: Issue, width: number): string {
  const priorityChar = issue.priority[0].toUpperCase();
  const colorFn = PRIORITY_COLOR[issue.priority] ?? chalk.dim;
  const prefix = colorFn(`[${priorityChar}]`) + " " + chalk.dim(issue.id) + " ";
  const prefixVisWidth = visibleWidth(prefix);
  const remainingWidth = width - prefixVisWidth;
  if (remainingWidth <= 0) {
    return truncateToWidth(prefix, width, "", true);
  }
  const title = truncateToWidth(issue.title, remainingWidth, "…", true);
  return prefix + title;
}

function padLine(line: string, width: number): string {
  const vw = visibleWidth(line);
  if (vw >= width) return truncateToWidth(line, width, "", true);
  return line + " ".repeat(width - vw);
}
