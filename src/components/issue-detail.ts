import type { Component } from "@mariozechner/pi-tui";
import { visibleWidth, truncateToWidth, matchesKey } from "@mariozechner/pi-tui";
import chalk from "chalk";
import { execSync } from "node:child_process";
import type { Issue } from "../issues.js";
import { getCategory, CATEGORY_COLOR } from "../label-category.js";

export class IssueDetailView implements Component {
  private issue: Issue;
  private scrollOffset = 0;
  private contentLines?: string[];
  private contentWidth?: number;
  private onClose?: () => void;

  constructor(issue: Issue, onClose?: () => void) {
    this.issue = issue;
    this.onClose = onClose;
  }

  handleInput(data: string): void {
    if (matchesKey(data, "escape")) {
      this.onClose?.();
      return;
    }
    if (matchesKey(data, "j") || matchesKey(data, "down")) {
      this.scrollOffset++;
      this.invalidate();
      return;
    }
    if (matchesKey(data, "k") || matchesKey(data, "up")) {
      this.scrollOffset = Math.max(0, this.scrollOffset - 1);
      this.invalidate();
      return;
    }
    if (matchesKey(data, "pageDown") || matchesKey(data, "space")) {
      const pageSize = Math.max(1, (process.stdout.rows || 24) - 4);
      this.scrollOffset += pageSize;
      this.invalidate();
      return;
    }
    if (matchesKey(data, "pageUp")) {
      const pageSize = Math.max(1, (process.stdout.rows || 24) - 4);
      this.scrollOffset = Math.max(0, this.scrollOffset - pageSize);
      this.invalidate();
      return;
    }
    if (matchesKey(data, "a")) {
      if (this.issue.tmux_session) {
        try {
          execSync(`tmux attach -t ${this.issue.tmux_session}`, { stdio: "inherit" });
        } catch {
          // tmux attach may fail if session doesn't exist
        }
      }
      return;
    }
  }

  invalidate(): void {
    this.contentLines = undefined;
    this.contentWidth = undefined;
  }

  render(width: number): string[] {
    const termHeight = process.stdout.rows || 24;
    const innerWidth = width - 4; // 2 for border chars + 2 for padding

    // Build content lines (without border)
    const content = this.buildContent(innerWidth);

    // Clamp scroll offset
    const viewableRows = termHeight - 4; // top border + bottom border + footer + extra
    const maxScroll = Math.max(0, content.length - viewableRows);
    if (this.scrollOffset > maxScroll) this.scrollOffset = maxScroll;

    // Apply scroll
    const visible = content.slice(this.scrollOffset, this.scrollOffset + viewableRows);

    // Build framed output
    const lines: string[] = [];

    // Top border with issue ID
    const idLabel = ` ${this.issue.id} `;
    const topBarLen = Math.max(0, width - 2 - visibleWidth(idLabel));
    const topLeft = Math.floor(topBarLen / 3);
    const topRight = topBarLen - topLeft;
    lines.push(
      chalk.dim("┌") +
      chalk.dim("─".repeat(topLeft)) +
      chalk.bold.cyan(idLabel) +
      chalk.dim("─".repeat(topRight)) +
      chalk.dim("┐")
    );

    // Content rows
    for (const line of visible) {
      const padded = padLine(line, innerWidth);
      lines.push(chalk.dim("│") + " " + padded + " " + chalk.dim("│"));
    }

    // Fill remaining space
    const filledRows = visible.length;
    const emptyRows = Math.max(0, viewableRows - filledRows);
    for (let i = 0; i < emptyRows; i++) {
      lines.push(chalk.dim("│") + " ".repeat(width - 2) + chalk.dim("│"));
    }

    // Scroll indicator in footer
    const scrollInfo = content.length > viewableRows
      ? ` ${this.scrollOffset + 1}-${Math.min(this.scrollOffset + viewableRows, content.length)}/${content.length} `
      : "";

    // Footer with shortcuts
    const tmuxHint = this.issue.tmux_session ? "  [a] Attach tmux" : "";
    const shortcuts = ` [Esc] Close  [j/k] Scroll${tmuxHint} `;
    const footerContent = shortcuts + scrollInfo;
    const footerPadded = padLine(chalk.dim(footerContent), innerWidth);
    lines.push(chalk.dim("│") + " " + footerPadded + " " + chalk.dim("│"));

    // Bottom border
    lines.push(chalk.dim("└") + chalk.dim("─".repeat(width - 2)) + chalk.dim("┘"));

    // Pad to full terminal height
    while (lines.length < termHeight) {
      lines.push(" ".repeat(width));
    }

    return lines;
  }

  private buildContent(width: number): string[] {
    if (this.contentLines && this.contentWidth === width) {
      return this.contentLines;
    }

    const issue = this.issue;
    const lines: string[] = [];

    // Title
    lines.push("");
    lines.push(chalk.bold.white(issue.title));
    lines.push("");

    // Status & Priority row
    const statusColor = STATUS_COLOR[issue.status] ?? chalk.white;
    const priorityColor = PRIORITY_COLOR[issue.priority] ?? chalk.dim;
    lines.push(
      chalk.dim("Status: ") + statusColor(issue.status) +
      "    " +
      chalk.dim("Priority: ") + priorityColor(issue.priority)
    );

    // Created date
    lines.push(chalk.dim("Created: ") + issue.createdAt);

    // Labels & category type
    if (issue.labels?.length) {
      lines.push(chalk.dim("Labels: ") + issue.labels.join(", "));
    }
    const cat = getCategory(issue.labels);
    if (cat) {
      lines.push(chalk.dim("Type: ") + CATEGORY_COLOR[cat](` ${cat} `));
    }

    // Agent assignment info
    if (issue.assignee) {
      lines.push(chalk.dim("Assignee: ") + chalk.cyan(issue.assignee));
    }
    if (issue.started_at) {
      lines.push(chalk.dim("Started: ") + issue.started_at);
    }
    if (issue.worktree) {
      lines.push(chalk.dim("Worktree: ") + issue.worktree);
    }
    if (issue.tmux_session) {
      lines.push(chalk.dim("Tmux: ") + issue.tmux_session + chalk.dim(" (press 'a' to attach)"));
    }
    lines.push("");

    // Body / Description
    if (issue.body && issue.body.trim()) {
      lines.push(chalk.bold.cyan("Description"));
      lines.push(chalk.dim("─".repeat(Math.min(width, 40))));
      // Word-wrap the body text
      const bodyLines = wrapText(issue.body, width);
      lines.push(...bodyLines);
    } else {
      lines.push(chalk.dim("No description."));
    }

    lines.push("");

    this.contentLines = lines;
    this.contentWidth = width;
    return lines;
  }
}

const STATUS_COLOR: Record<string, (s: string) => string> = {
  "todo": chalk.yellow,
  "in-progress": chalk.blue,
  "done": chalk.green,
};

const PRIORITY_COLOR: Record<string, (s: string) => string> = {
  high: chalk.red,
  medium: chalk.yellow,
  low: chalk.dim,
};

function padLine(line: string, width: number): string {
  const vw = visibleWidth(line);
  if (vw >= width) return truncateToWidth(line, width, "…", true);
  return line + " ".repeat(width - vw);
}

function wrapText(text: string, width: number): string[] {
  const result: string[] = [];
  for (const paragraph of text.split("\n")) {
    if (paragraph.trim() === "") {
      result.push("");
      continue;
    }
    const words = paragraph.split(/\s+/);
    let currentLine = "";
    for (const word of words) {
      if (!currentLine) {
        currentLine = word;
      } else if (visibleWidth(currentLine + " " + word) <= width) {
        currentLine += " " + word;
      } else {
        result.push(currentLine);
        currentLine = word;
      }
    }
    if (currentLine) result.push(currentLine);
  }
  return result;
}
