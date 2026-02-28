import type { Component } from "@mariozechner/pi-tui";
import { visibleWidth, truncateToWidth, matchesKey } from "@mariozechner/pi-tui";
import chalk from "chalk";
import { listIssues, type Issue, type Status } from "../issues.js";
import { loadConfig, type ProjectConfig } from "../config.js";

const DEFAULT_ICONS = ["○", "◑", "●"];
const EXTRA_ICON = "◎";

interface Section {
  status: Status;
  label: string;
  icon: string;
}

function buildSections(config: ProjectConfig): Section[] {
  return config.statuses.map((status, i) => ({
    status,
    label: status.toUpperCase(),
    icon: i < DEFAULT_ICONS.length ? DEFAULT_ICONS[i] : EXTRA_ICON,
  }));
}

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
  private sections: Section[];
  private cursorIndex = 0;
  private scrollOffset = 0;
  focused = false;

  /** Maps flat issue index to the line index in the full rendered output */
  private issueLineIndices: number[] = [];

  constructor(cwd: string, config?: ProjectConfig) {
    this.cwd = cwd;
    const cfg = config ?? loadConfig(cwd);
    this.sections = buildSections(cfg);
    this.issues = listIssues(cwd);
  }

  /** Returns a flat ordered list of all issues (across all sections) */
  private getFlatIssues(): Issue[] {
    const grouped = new Map<Status, Issue[]>();
    for (const s of this.sections) grouped.set(s.status, []);
    for (const issue of this.issues) {
      grouped.get(issue.status)?.push(issue);
    }
    const flat: Issue[] = [];
    for (const section of this.sections) {
      flat.push(...grouped.get(section.status)!);
    }
    return flat;
  }

  refresh(): void {
    this.issues = listIssues(this.cwd);
    this.cachedLines = undefined;
    this.cachedWidth = undefined;
    // Clamp cursor to new issue count
    const total = this.getFlatIssues().length;
    if (this.cursorIndex >= total) {
      this.cursorIndex = Math.max(0, total - 1);
    }
  }

  invalidate(): void {
    this.cachedLines = undefined;
    this.cachedWidth = undefined;
  }

  handleInput(data: string): void {
    const total = this.getFlatIssues().length;
    if (total === 0) return;

    if (matchesKey(data, "j") || matchesKey(data, "down")) {
      if (this.cursorIndex < total - 1) {
        this.cursorIndex++;
        this.cachedLines = undefined;
        this.cachedWidth = undefined;
      }
    } else if (matchesKey(data, "k") || matchesKey(data, "up")) {
      if (this.cursorIndex > 0) {
        this.cursorIndex--;
        this.cachedLines = undefined;
        this.cachedWidth = undefined;
      }
    }
  }

  getSelectedIssue(): Issue | null {
    const flat = this.getFlatIssues();
    if (flat.length === 0 || this.cursorIndex >= flat.length) return null;
    return flat[this.cursorIndex];
  }

  render(width: number): string[] {
    const terminalHeight = process.stdout.rows || 24;

    const grouped = new Map<Status, Issue[]>();
    for (const s of this.sections) grouped.set(s.status, []);
    for (const issue of this.issues) {
      const bucket = grouped.get(issue.status);
      if (bucket) bucket.push(issue);
    }

    const lines: string[] = [];
    this.issueLineIndices = [];
    let flatIndex = 0;

    // Title
    lines.push(pad(chalk.bold(" BOARD") + chalk.dim(` (${this.issues.length})`), width));
    lines.push(pad(chalk.dim(" " + "─".repeat(width - 2)), width));

    for (const section of this.sections) {
      const issues = grouped.get(section.status) ?? [];
      // Section header
      lines.push(pad("", width));
      lines.push(pad(` ${chalk.bold.cyan(section.icon + " " + section.label)} ${chalk.dim(`(${issues.length})`)}`, width));

      if (issues.length === 0) {
        lines.push(pad(chalk.dim("   No issues"), width));
      } else {
        for (const issue of issues) {
          const isSelected = this.focused && flatIndex === this.cursorIndex;
          this.issueLineIndices.push(lines.length);
          lines.push(renderIssueRow(issue, width, isSelected));
          flatIndex++;
        }
      }
    }

    // Apply scrolling: keep cursor in view
    const cursorLine = this.issueLineIndices[this.cursorIndex] ?? 0;
    // Reserve 1 line at bottom for scroll indicator
    const viewportHeight = terminalHeight - 1;

    if (cursorLine < this.scrollOffset) {
      this.scrollOffset = cursorLine;
    } else if (cursorLine >= this.scrollOffset + viewportHeight) {
      this.scrollOffset = cursorLine - viewportHeight + 1;
    }
    // Clamp scroll offset
    this.scrollOffset = Math.max(0, Math.min(this.scrollOffset, Math.max(0, lines.length - viewportHeight)));

    const visibleLines = lines.slice(this.scrollOffset, this.scrollOffset + viewportHeight);

    // Pad to fill viewport if needed
    while (visibleLines.length < viewportHeight) {
      visibleLines.push(pad("", width));
    }

    // Scroll indicator line
    if (lines.length > viewportHeight) {
      const canUp = this.scrollOffset > 0;
      const canDown = this.scrollOffset + viewportHeight < lines.length;
      const arrows = (canUp ? "▲" : " ") + (canDown ? "▼" : " ");
      const pos = `${this.scrollOffset + 1}-${Math.min(this.scrollOffset + viewportHeight, lines.length)}/${lines.length}`;
      const indicator = chalk.dim(` ${arrows} ${pos}`);
      visibleLines.push(pad(indicator, width));
    } else {
      visibleLines.push(pad("", width));
    }

    this.cachedLines = visibleLines;
    this.cachedWidth = width;
    return visibleLines;
  }
}

function renderIssueRow(issue: Issue, width: number, selected: boolean): string {
  const priorityChar = issue.priority[0].toUpperCase();
  const colorFn = PRIORITY_COLOR[issue.priority] ?? chalk.dim;
  const blocked = issue.blocked_by?.length ? chalk.red(" \u2298") : "";
  const labelTags = issue.labels?.length
    ? " " + issue.labels.map((l) => chalk.bgBlue.white(` ${l} `)).join(" ")
    : "";
  const suffix = blocked + labelTags;
  const suffixVw = visibleWidth(suffix);
  const indicator = selected ? chalk.cyan("▸ ") : "  ";
  const prefix = ` ${indicator}${colorFn(`[${priorityChar}]`)} ${chalk.dim(issue.id)} `;
  const prefixVw = visibleWidth(prefix);
  const remaining = width - prefixVw - suffixVw;
  if (remaining <= 0) return truncateToWidth(prefix + suffix, width, "", true);
  const titleText = truncateToWidth(issue.title, remaining, "\u2026", true);
  const row = prefix + titleText + suffix;
  if (selected) {
    return pad(chalk.bgGray(row), width);
  }
  return pad(row, width);
}

function pad(line: string, width: number): string {
  const vw = visibleWidth(line);
  if (vw >= width) return truncateToWidth(line, width, "", true);
  return line + " ".repeat(width - vw);
}
